-- Phase 6: live updates, private receipts, and a nightly job for monthly bills.

-- ===========================================================================
-- 1. Live updates (Supabase Realtime, private broadcast channels)
-- ---------------------------------------------------------------------------
-- When household data changes, the database sends a tiny "something changed" message to the
-- private channel household:<id>. The message carries only the table name, never the data:
-- the app then re-reads through the normal RLS-protected queries. Only members can listen.
-- People affected personally (a join request decided, a member removed) also get user:<id>.
-- ===========================================================================

create function public.broadcast_household_change() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  rec jsonb := to_jsonb(case when tg_op = 'DELETE' then old else new end);
  hid uuid;
  payload jsonb := jsonb_build_object('table', tg_table_name, 'op', tg_op);
begin
  if tg_table_name = 'households' then
    hid := (rec ->> 'id')::uuid;
  elsif tg_table_name = 'bill_shares' then
    select household_id into hid from public.bills where id = (rec ->> 'bill_id')::uuid;
  else
    hid := (rec ->> 'household_id')::uuid;
  end if;

  if hid is not null then
    perform realtime.send(payload, 'changed', 'household:' || hid, true);
  end if;

  -- Tell the person themselves when their request or membership changes
  if tg_table_name in ('join_requests', 'household_members') and rec ? 'user_id' then
    perform realtime.send(payload, 'changed', 'user:' || (rec ->> 'user_id'), true);
  end if;
  return null;
end $$;

revoke execute on function public.broadcast_household_change() from public, anon, authenticated;

create trigger households_broadcast        after update or delete           on public.households        for each row execute function public.broadcast_household_change();
create trigger household_members_broadcast after insert or update or delete on public.household_members for each row execute function public.broadcast_household_change();
create trigger invites_broadcast           after insert or update or delete on public.invites           for each row execute function public.broadcast_household_change();
create trigger join_requests_broadcast     after insert or update or delete on public.join_requests     for each row execute function public.broadcast_household_change();
create trigger bills_broadcast             after insert or update or delete on public.bills             for each row execute function public.broadcast_household_change();
create trigger bill_shares_broadcast       after insert or update or delete on public.bill_shares       for each row execute function public.broadcast_household_change();
create trigger chores_broadcast            after insert or update or delete on public.chores            for each row execute function public.broadcast_household_change();

-- Who may listen to a channel: members to household:<id>, and each person to user:<their id>
create function public.can_listen(p_topic text) returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null or p_topic is null then return false; end if;
  if p_topic = 'user:' || (select auth.uid())::text then return true; end if;
  if p_topic ~ '^household:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return public.is_member(substr(p_topic, 11)::uuid);
  end if;
  return false;
end $$;

revoke execute on function public.can_listen(text) from public, anon;
grant execute on function public.can_listen(text) to authenticated;

create policy "members listen to their household channel" on realtime.messages
  for select to authenticated
  using (public.can_listen((select realtime.topic())));

-- ===========================================================================
-- 2. Receipts (private storage bucket)
-- ---------------------------------------------------------------------------
-- Path: {household_id}/{bill_id}/{user_id}-{timestamp}.{ext}. 5 MB max, images and PDF only.
-- Housemates can view; you can only upload your own receipt for a bill you're on.
-- The app shows receipts through short-lived signed URLs.
-- ===========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'])
on conflict (id) do nothing;

-- Splits a receipt path into its parts, or returns nulls if it isn't shaped right
create function public.receipt_path_parts(p_name text, out household_id uuid, out bill_id uuid, out file_name text)
language plpgsql immutable set search_path = ''
as $$
declare
  parts text[] := string_to_array(coalesce(p_name, ''), '/');
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if array_length(parts, 1) = 3 and parts[1] ~ uuid_re and parts[2] ~ uuid_re and parts[3] <> '' then
    household_id := parts[1]::uuid;
    bill_id := parts[2]::uuid;
    file_name := parts[3];
  end if;
end $$;

revoke execute on function public.receipt_path_parts(text) from public, anon, authenticated;

create function public.can_read_receipt(p_name text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce(public.is_member((public.receipt_path_parts(p_name)).household_id), false);
$$;

create function public.can_upload_receipt(p_name text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.receipt_path_parts(p_name) p
    join public.bills b on b.id = p.bill_id and b.household_id = p.household_id
    join public.bill_shares s on s.bill_id = b.id and s.user_id = (select auth.uid())
    where public.is_member(p.household_id)
      and p.file_name like (select auth.uid())::text || '-%'
  );
$$;

revoke execute on function public.can_read_receipt(text) from public, anon;
revoke execute on function public.can_upload_receipt(text) from public, anon;
grant execute on function public.can_read_receipt(text) to authenticated;
grant execute on function public.can_upload_receipt(text) to authenticated;

create policy "housemates view receipts" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and public.can_read_receipt(name));

create policy "upload your own receipts" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and public.can_upload_receipt(name));

create policy "delete your own receipts" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and owner_id = (select auth.uid())::text);

-- Link an uploaded receipt to your share of a bill
create function public.attach_receipt(p_bill uuid, p_path text) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  bl public.bills;
  p record;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into bl from public.bills where id = p_bill;
  if not found or not public.is_member(bl.household_id) then raise exception 'not_found'; end if;
  select * into p from public.receipt_path_parts(p_path);
  if p.household_id is distinct from bl.household_id or p.bill_id is distinct from p_bill
     or p.file_name not like uid::text || '-%' then
    raise exception 'invalid_receipt_path';
  end if;
  update public.bill_shares set receipt_path = p_path where bill_id = p_bill and user_id = uid;
  if not found then raise exception 'not_on_bill'; end if;
end $$;

revoke execute on function public.attach_receipt(uuid, text) from public, anon;
grant execute on function public.attach_receipt(uuid, text) to authenticated;

-- ===========================================================================
-- 3. Monthly bills: a nightly job, so next month's bill appears even if nobody opens the app
-- ===========================================================================

-- Same logic as before, without the "signed in member" check, for the job to use
create function public.roll_household_bills(p_household uuid) returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  today date := public.household_today(p_household);
  people uuid[] := public.member_order(p_household);
  latest public.bills;
  anchor int;
  next_due date;
  next_payer uuid;
  next_mode text;
  amounts jsonb;
  new_id uuid;
  added int := 0;
  guard int;
  series uuid;
begin
  if coalesce(array_length(people, 1), 0) = 0 then return 0; end if;

  for series in
    select distinct b.series_id from public.bills b
     where b.household_id = p_household and b.series_id is not null
  loop
    guard := 0;
    loop
      select * into latest from public.bills where series_id = series order by due_date desc limit 1;
      exit when latest.recurrence <> 'monthly' or latest.due_date > today or guard >= 12;
      guard := guard + 1;

      select extract(day from min(due_date))::int into anchor from public.bills where series_id = series;
      next_due := (date_trunc('month', latest.due_date) + interval '1 month')::date;
      next_due := next_due + (least(anchor, extract(day from (date_trunc('month', next_due) + interval '1 month - 1 day'))::int) - 1);

      next_payer := case when latest.payer_id = any (people) then latest.payer_id else people[1] end;

      select jsonb_object_agg(s.user_id::text, s.amount_cents) into amounts
        from public.bill_shares s where s.bill_id = latest.id;
      next_mode := latest.split_mode;
      if next_mode = 'custom' and (
        (select count(*) from jsonb_object_keys(amounts)) <> array_length(people, 1)
        or exists (select 1 from unnest(people) p where not amounts ? p::text)
      ) then
        next_mode := 'equal';
      end if;

      new_id := gen_random_uuid();
      insert into public.bills (id, household_id, name, category, emoji, total_cents, due_date, payer_id, created_by,
                                recurrence, series_id, split_mode)
      values (new_id, p_household, latest.name, latest.category, latest.emoji, latest.total_cents, next_due, next_payer,
              latest.created_by, 'monthly', series, next_mode)
      on conflict do nothing;
      if not found then exit; end if;

      insert into public.bill_shares (bill_id, user_id, amount_cents)
      select new_id, c.user_id, c.amount_cents
        from public.compute_shares(people, latest.total_cents, next_mode, case when next_mode = 'custom' then amounts end) c;

      update public.bills set recurrence = 'none' where id = latest.id;
      added := added + 1;
    end loop;
  end loop;
  return added;
end $$;

revoke execute on function public.roll_household_bills(uuid) from public, anon, authenticated;

-- The app's call keeps its member check and now shares the logic above
create or replace function public.roll_recurring_bills(p_household uuid) returns integer
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'not_signed_in'; end if;
  if not public.is_member(p_household) then raise exception 'not_a_member'; end if;
  return public.roll_household_bills(p_household);
end $$;

-- Every household, for the nightly job (not callable from the app)
create function public.roll_all_recurring_bills() returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  h uuid;
  total int := 0;
begin
  for h in select id from public.households loop
    total := total + public.roll_household_bills(h);
  end loop;
  return total;
end $$;

revoke execute on function public.roll_all_recurring_bills() from public, anon, authenticated;

create extension if not exists pg_cron;

-- 06:15 UTC every day (about 2 am in Toronto)
select cron.schedule('roll-recurring-bills', '15 6 * * *', 'select public.roll_all_recurring_bills()');
