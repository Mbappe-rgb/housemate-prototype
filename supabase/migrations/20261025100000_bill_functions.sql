-- Phase 4: bills. Every bill change goes through one of these functions, which check the rules:
-- * Only household members can add or see bills; the payer must be a member.
-- * Shares add up to the total (also enforced by the shares-total constraint trigger).
--   Equal splits give leftover cents to the earliest members, the same as the app shows.
-- * Only the bill's creator edits the split, and not once anyone other than the payer has paid.
-- * The creator or the household admin changes payer/repeat or deletes; changing the payer clears payments.
-- * Only the person themselves, or the bill's payer ("mark received"), marks a share paid or unpaid.
-- * Deleting is only allowed while nothing is paid.
-- * Monthly bills: once a bill in a series is due, the next month's copy is created (roll_recurring_bills).

-- A monthly series has at most one bill per due date (makes rolling safe to run twice)
create unique index bills_series_due_unique on public.bills (series_id, due_date) where series_id is not null;

-- ---------------------------------------------------------------------------
-- Helpers (internal)
-- ---------------------------------------------------------------------------

-- Share amounts for a list of people, in the order given: equal split, or custom amounts from jsonb.
-- Raises split_mismatch if custom amounts don't cover exactly these people or don't add up.
create function public.compute_shares(p_people uuid[], p_total integer, p_mode text, p_amounts jsonb)
returns table (user_id uuid, amount_cents integer)
language plpgsql immutable set search_path = ''
as $$
declare
  n int := coalesce(array_length(p_people, 1), 0);
  base int;
  extra int;
  i int;
  v jsonb;
  total_custom bigint := 0;
begin
  if n = 0 then raise exception 'no_members'; end if;

  if p_mode = 'equal' then
    base := p_total / n;
    extra := p_total - base * n;
    for i in 1..n loop
      user_id := p_people[i];
      amount_cents := base + case when i <= extra then 1 else 0 end;
      return next;
    end loop;
    return;
  end if;

  if p_mode <> 'custom' or p_amounts is null or jsonb_typeof(p_amounts) <> 'object' then
    raise exception 'split_mismatch';
  end if;
  if (select count(*) from jsonb_object_keys(p_amounts)) <> n then
    raise exception 'split_mismatch';
  end if;
  for i in 1..n loop
    v := p_amounts -> (p_people[i]::text);
    if v is null or jsonb_typeof(v) <> 'number' or (v::text)::numeric <> floor((v::text)::numeric) or (v::text)::numeric < 0 then
      raise exception 'split_mismatch';
    end if;
    user_id := p_people[i];
    amount_cents := (v::text)::integer;
    total_custom := total_custom + amount_cents;
    return next;
  end loop;
  if total_custom <> p_total then raise exception 'split_mismatch'; end if;
end $$;

revoke execute on function public.compute_shares(uuid[], integer, text, jsonb) from public, anon, authenticated;

-- Current members of a household, earliest first
create function public.member_order(h uuid) returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(user_id order by joined_at, user_id), '{}')
  from public.household_members where household_id = h;
$$;

revoke execute on function public.member_order(uuid) from public, anon, authenticated;

-- People on a bill, earliest member first (anyone who has since left goes last)
create function public.bill_people(b uuid) returns uuid[]
language sql stable security definer set search_path = ''
as $$
  select coalesce(array_agg(s.user_id order by m.joined_at nulls last, s.user_id), '{}')
  from public.bill_shares s
  join public.bills bl on bl.id = s.bill_id
  left join public.household_members m on m.user_id = s.user_id and m.household_id = bl.household_id
  where s.bill_id = b;
$$;

revoke execute on function public.bill_people(uuid) from public, anon, authenticated;

-- "Today" in a household's time zone
create function public.household_today(h uuid) returns date
language sql stable security definer set search_path = ''
as $$
  select (now() at time zone coalesce((select timezone from public.households where id = h), 'America/Toronto'))::date;
$$;

revoke execute on function public.household_today(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_bill: the bill and one share per current member, in one transaction
-- p_amounts (custom only): {"<user id>": cents, ...} for every member
-- ---------------------------------------------------------------------------
create function public.create_bill(
  p_household   uuid,
  p_name        text,
  p_category    text,
  p_emoji       text,
  p_total_cents integer,
  p_due_date    date,
  p_payer       uuid,
  p_recurrence  text default 'none',
  p_split_mode  text default 'equal',
  p_amounts     jsonb default null
) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  people uuid[];
  b uuid := gen_random_uuid();
  today date;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if not public.is_member(p_household) then raise exception 'not_a_member'; end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 1 and 60 then raise exception 'invalid_name'; end if;
  if p_total_cents is null or p_total_cents not between 1 and 100000000 then raise exception 'invalid_amount'; end if;
  if p_recurrence not in ('none', 'monthly') or p_split_mode not in ('equal', 'custom') then raise exception 'invalid_option'; end if;

  today := public.household_today(p_household);
  if p_due_date is null or p_due_date < today - 365 or p_due_date > today + 366 then raise exception 'invalid_date'; end if;

  people := public.member_order(p_household);
  if not (p_payer = any (people)) then raise exception 'payer_not_member'; end if;

  insert into public.bills (id, household_id, name, category, emoji, total_cents, due_date, payer_id, created_by,
                            recurrence, series_id, split_mode)
  values (b, p_household, btrim(p_name), coalesce(nullif(btrim(p_category), ''), 'Other'), nullif(p_emoji, ''),
          p_total_cents, p_due_date, p_payer, uid, p_recurrence,
          case when p_recurrence = 'monthly' then b end, p_split_mode);

  insert into public.bill_shares (bill_id, user_id, amount_cents)
  select b, s.user_id, s.amount_cents
  from public.compute_shares(people, p_total_cents, p_split_mode, p_amounts) s;

  return b;
end $$;

-- ---------------------------------------------------------------------------
-- set_share_paid: I paid my share (or, as payer, I paid the provider);
-- or the payer marks someone else's share as received. p_paid = false undoes it.
-- ---------------------------------------------------------------------------
create function public.set_share_paid(p_bill uuid, p_user uuid, p_paid boolean) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  bl public.bills;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into bl from public.bills where id = p_bill;
  if not found or not public.is_member(bl.household_id) then raise exception 'not_found'; end if;
  if uid <> p_user and uid is distinct from bl.payer_id then raise exception 'not_allowed'; end if;

  update public.bill_shares
     set paid_at = case when p_paid then coalesce(paid_at, now()) else null end,
         marked_by = uid,
         receipt_path = case when p_paid then receipt_path else null end
   where bill_id = p_bill and user_id = p_user;
  if not found then raise exception 'not_on_bill'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- update_bill_split: creator only, and only while nobody but the payer has paid
-- ---------------------------------------------------------------------------
create function public.update_bill_split(p_bill uuid, p_split_mode text, p_amounts jsonb default null) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  bl public.bills;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into bl from public.bills where id = p_bill for update;
  if not found or not public.is_member(bl.household_id) then raise exception 'not_found'; end if;
  if bl.created_by is distinct from uid then raise exception 'not_creator'; end if;
  if p_split_mode not in ('equal', 'custom') then raise exception 'invalid_option'; end if;
  if exists (
    select 1 from public.bill_shares
     where bill_id = p_bill and user_id is distinct from bl.payer_id and paid_at is not null
  ) then
    raise exception 'split_locked';
  end if;

  update public.bill_shares s
     set amount_cents = c.amount_cents
    from public.compute_shares(public.bill_people(p_bill), bl.total_cents, p_split_mode, p_amounts) c
   where s.bill_id = p_bill and s.user_id = c.user_id;

  update public.bills set split_mode = p_split_mode where id = p_bill;
end $$;

-- ---------------------------------------------------------------------------
-- update_bill_settings: who pays, and whether it repeats monthly.
-- Creator or household admin. Changing the payer clears every payment.
-- ---------------------------------------------------------------------------
create function public.update_bill_settings(p_bill uuid, p_payer uuid, p_recurrence text) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  bl public.bills;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into bl from public.bills where id = p_bill for update;
  if not found or not public.is_member(bl.household_id) then raise exception 'not_found'; end if;
  if bl.created_by is distinct from uid and not public.is_owner(bl.household_id) then raise exception 'not_allowed'; end if;
  if p_recurrence not in ('none', 'monthly') then raise exception 'invalid_option'; end if;
  if not exists (select 1 from public.bill_shares where bill_id = p_bill and user_id = p_payer)
     or not exists (select 1 from public.household_members where household_id = bl.household_id and user_id = p_payer) then
    raise exception 'payer_not_member';
  end if;

  if p_payer is distinct from bl.payer_id then
    update public.bill_shares set paid_at = null, marked_by = null, receipt_path = null where bill_id = p_bill;
  end if;

  update public.bills
     set payer_id = p_payer,
         recurrence = p_recurrence,
         series_id = case when p_recurrence = 'monthly' then coalesce(series_id, id) else series_id end
   where id = p_bill;
end $$;

-- ---------------------------------------------------------------------------
-- delete_bill: creator or admin, only while nothing is paid
-- ---------------------------------------------------------------------------
create function public.delete_bill(p_bill uuid) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  bl public.bills;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into bl from public.bills where id = p_bill for update;
  if not found or not public.is_member(bl.household_id) then raise exception 'not_found'; end if;
  if bl.created_by is distinct from uid and not public.is_owner(bl.household_id) then raise exception 'not_allowed'; end if;
  if exists (select 1 from public.bill_shares where bill_id = p_bill and paid_at is not null) then
    raise exception 'bill_has_payments';
  end if;
  delete from public.bills where id = p_bill;
end $$;

-- ---------------------------------------------------------------------------
-- roll_recurring_bills: for each monthly series whose latest bill is due (today or earlier),
-- add the next month's bill. Same day of month (clamped to short months), same payer if still a
-- member, same custom split if the same people are still members, otherwise an equal split.
-- Safe to call often; the app calls it when it loads. Returns how many bills were added.
-- ---------------------------------------------------------------------------
create function public.roll_recurring_bills(p_household uuid) returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  today date;
  people uuid[];
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
  if (select auth.uid()) is null then raise exception 'not_signed_in'; end if;
  if not public.is_member(p_household) then raise exception 'not_a_member'; end if;
  today := public.household_today(p_household);
  people := public.member_order(p_household);

  for series in
    select distinct b.series_id from public.bills b
     where b.household_id = p_household and b.series_id is not null
  loop
    guard := 0;
    loop
      select * into latest from public.bills
       where series_id = series order by due_date desc limit 1;
      exit when latest.recurrence <> 'monthly' or latest.due_date > today or guard >= 12;
      guard := guard + 1;

      select extract(day from min(due_date))::int into anchor from public.bills where series_id = series;
      next_due := (date_trunc('month', latest.due_date) + interval '1 month')::date;
      next_due := next_due + (least(anchor, extract(day from (date_trunc('month', next_due) + interval '1 month - 1 day'))::int) - 1);

      next_payer := case when latest.payer_id = any (people) then latest.payer_id else people[1] end;

      -- Keep a custom split only if it was for exactly the current members
      select jsonb_object_agg(s.user_id::text, s.amount_cents) into amounts
        from public.bill_shares s where s.bill_id = latest.id;
      next_mode := latest.split_mode;
      if next_mode = 'custom' and (
        (select count(*) from jsonb_object_keys(amounts)) <> coalesce(array_length(people, 1), 0)
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

      -- Only the newest bill in a series repeats; older ones become one-off history
      update public.bills set recurrence = 'none' where id = latest.id;
      added := added + 1;
    end loop;
  end loop;
  return added;
end $$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
revoke execute on function public.create_bill(uuid, text, text, text, integer, date, uuid, text, text, jsonb) from public, anon;
revoke execute on function public.set_share_paid(uuid, uuid, boolean)         from public, anon;
revoke execute on function public.update_bill_split(uuid, text, jsonb)        from public, anon;
revoke execute on function public.update_bill_settings(uuid, uuid, text)      from public, anon;
revoke execute on function public.delete_bill(uuid)                           from public, anon;
revoke execute on function public.roll_recurring_bills(uuid)                  from public, anon;

grant execute on function public.create_bill(uuid, text, text, text, integer, date, uuid, text, text, jsonb) to authenticated;
grant execute on function public.set_share_paid(uuid, uuid, boolean)          to authenticated;
grant execute on function public.update_bill_split(uuid, text, jsonb)         to authenticated;
grant execute on function public.update_bill_settings(uuid, uuid, text)       to authenticated;
grant execute on function public.delete_bill(uuid)                            to authenticated;
grant execute on function public.roll_recurring_bills(uuid)                   to authenticated;
