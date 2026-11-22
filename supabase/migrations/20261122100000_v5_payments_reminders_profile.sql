-- v5 redesign: two-step payments (Sent, then Confirmed), in-app reminders, new profile fields and themes.
-- Everything here is additive, so the app currently on main keeps working until the v5 app ships.
--
-- Payment states for a housemate's share (see docs/design/v5-screen-map.pdf, "payment states"):
--   Unpaid : sent_at null,     paid_at null
--   Sent   : sent_at set,      paid_at null   <- the housemate says they sent the e-transfer
--   Paid   : paid_at set                      <- the bill payer confirmed it (or marked it paid)
-- The payer's own share keeps its meaning: paid_at = "I paid the provider".

-- ===========================================================================
-- 1. Sent, then Confirm
-- ===========================================================================
alter table public.bill_shares add column sent_at timestamptz;

-- A housemate marks their share as sent (or takes it back). Not for the payer's own share.
create function public.mark_share_sent(p_bill uuid, p_sent boolean) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  bl public.bills;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into bl from public.bills where id = p_bill;
  if not found or not public.is_member(bl.household_id) then raise exception 'not_found'; end if;
  if bl.payer_id = uid then raise exception 'payer_pays_provider'; end if;

  update public.bill_shares
     set sent_at = case when p_sent then coalesce(sent_at, now()) else null end
   where bill_id = p_bill and user_id = uid and paid_at is null;
  if not found then
    if exists (select 1 from public.bill_shares where bill_id = p_bill and user_id = uid) then
      raise exception 'already_confirmed';
    end if;
    raise exception 'not_on_bill';
  end if;
end $$;

revoke execute on function public.mark_share_sent(uuid, boolean) from public, anon;
grant execute on function public.mark_share_sent(uuid, boolean) to authenticated;

-- set_share_paid: the payer confirms ("Confirm", "Mark as paid") or undoes ("Mark as unpaid");
-- the payer also marks their own provider payment. Undo now clears "sent" too.
create or replace function public.set_share_paid(p_bill uuid, p_user uuid, p_paid boolean) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  bl public.bills;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into bl from public.bills where id = p_bill;
  if not found or not public.is_member(bl.household_id) then raise exception 'not_found'; end if;
  -- Kept for the current app: people may still mark their own share; the v5 app uses mark_share_sent.
  if uid <> p_user and uid is distinct from bl.payer_id then raise exception 'not_allowed'; end if;

  update public.bill_shares
     set paid_at = case when p_paid then coalesce(paid_at, now()) else null end,
         sent_at = case when p_paid then sent_at else null end,
         marked_by = uid,
         receipt_path = case when p_paid then receipt_path else null end
   where bill_id = p_bill and user_id = p_user;
  if not found then raise exception 'not_on_bill'; end if;
end $$;

-- The split locks once anyone (other than the payer) has sent or paid
create or replace function public.update_bill_split(p_bill uuid, p_split_mode text, p_amounts jsonb default null) returns void
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
     where bill_id = p_bill and user_id is distinct from bl.payer_id
       and (paid_at is not null or sent_at is not null)
  ) then
    raise exception 'split_locked';
  end if;

  update public.bill_shares s
     set amount_cents = c.amount_cents
    from public.compute_shares(public.bill_people(p_bill), bl.total_cents, p_split_mode, p_amounts) c
   where s.bill_id = p_bill and s.user_id = c.user_id;

  update public.bills set split_mode = p_split_mode where id = p_bill;
end $$;

-- Changing the payer clears every payment, including "sent"
create or replace function public.update_bill_settings(p_bill uuid, p_payer uuid, p_recurrence text) returns void
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
    update public.bill_shares set paid_at = null, sent_at = null, marked_by = null, receipt_path = null where bill_id = p_bill;
  end if;

  update public.bills
     set payer_id = p_payer,
         recurrence = p_recurrence,
         series_id = case when p_recurrence = 'monthly' then coalesce(series_id, id) else series_id end
   where id = p_bill;
end $$;

-- A bill with any payment (sent or paid) can't be deleted
create or replace function public.delete_bill(p_bill uuid) returns void
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
  if exists (select 1 from public.bill_shares where bill_id = p_bill and (paid_at is not null or sent_at is not null)) then
    raise exception 'bill_has_payments';
  end if;
  delete from public.bills where id = p_bill;
end $$;

-- ===========================================================================
-- 2. In-app reminders ("Remind" / "Send reminder"). Emails come in Phase 7.
-- ===========================================================================
create table public.notifications (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,   -- who receives it
  from_user     uuid references public.profiles (id) on delete set null,
  kind          text not null check (kind in ('bill_reminder')),
  bill_id       uuid references public.bills (id) on delete cascade,
  created_at    timestamptz not null default now(),
  read_at       timestamptz
);

create index notifications_user_idx on public.notifications (user_id, read_at);
create index notifications_bill_idx on public.notifications (bill_id, user_id, created_at);

alter table public.notifications enable row level security;
revoke all on table public.notifications from anon, authenticated;
grant select on table public.notifications to authenticated;

-- You see reminders sent to you, and the ones you sent (so the payer sees "Reminded")
create policy "recipient or sender reads notifications" on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()) or from_user = (select auth.uid()));

-- The bill payer reminds housemates who haven't sent or paid. One reminder per person per bill per day.
-- p_user null = everyone still unpaid. Returns how many reminders were sent.
create function public.send_bill_reminder(p_bill uuid, p_user uuid default null) returns integer
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  bl public.bills;
  sent int := 0;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into bl from public.bills where id = p_bill;
  if not found or not public.is_member(bl.household_id) then raise exception 'not_found'; end if;
  if bl.payer_id is distinct from uid then raise exception 'not_payer'; end if;

  insert into public.notifications (household_id, user_id, from_user, kind, bill_id)
  select bl.household_id, s.user_id, uid, 'bill_reminder', p_bill
    from public.bill_shares s
   where s.bill_id = p_bill
     and s.user_id <> uid
     and s.paid_at is null and s.sent_at is null
     and (p_user is null or s.user_id = p_user)
     and exists (select 1 from public.household_members m where m.household_id = bl.household_id and m.user_id = s.user_id)
     and not exists (
       select 1 from public.notifications n
        where n.bill_id = p_bill and n.user_id = s.user_id and n.created_at > now() - interval '1 day'
     );
  get diagnostics sent = row_count;
  return sent;
end $$;

create function public.mark_notifications_read() returns void
language sql volatile security definer set search_path = ''
as $$
  update public.notifications set read_at = now()
   where user_id = (select auth.uid()) and read_at is null;
$$;

revoke execute on function public.send_bill_reminder(uuid, uuid) from public, anon;
revoke execute on function public.mark_notifications_read() from public, anon;
grant execute on function public.send_bill_reminder(uuid, uuid) to authenticated;
grant execute on function public.mark_notifications_read() to authenticated;

-- Tell the recipient's phone right away (same private channels as Phase 6)
create function public.broadcast_notification() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform realtime.send(jsonb_build_object('table', 'notifications', 'op', tg_op), 'changed', 'user:' || new.user_id, true);
  return null;
end $$;

revoke execute on function public.broadcast_notification() from public, anon, authenticated;

create trigger notifications_broadcast after insert on public.notifications
  for each row execute function public.broadcast_notification();

-- ===========================================================================
-- 3. Profile: full name, one e-transfer detail (email or phone), privacy consent, v5 themes
-- ===========================================================================
alter table public.profiles
  add column full_name text check (full_name is null or char_length(btrim(full_name)) between 1 and 80),
  add column etransfer text check (etransfer is null or char_length(btrim(etransfer)) between 3 and 254),
  add column privacy_accepted_at timestamptz;

-- Bring over what people already entered (e-transfer email first, else phone)
update public.profiles set etransfer = coalesce(nullif(btrim(etransfer_email), ''), nullif(btrim(phone), ''))
 where etransfer is null;

grant update (full_name, etransfer) on public.profiles to authenticated;

-- v5 themes: Forest (default), Night, Lilac. Old names stay valid until the old app is gone.
alter table public.profiles drop constraint profiles_theme_check;
update public.profiles set theme = case theme when 'midnight' then 'night' when 'pop' then 'lilac' else 'forest' end
 where theme in ('lime', 'sage', 'midnight', 'pop');
alter table public.profiles alter column theme set default 'forest';
alter table public.profiles add constraint profiles_theme_check
  check (theme in ('forest', 'night', 'lilac', 'lime', 'sage', 'midnight', 'pop'));

-- New accounts: keep the first name, and record privacy consent given on the v5 privacy page
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, privacy_accepted_at)
  values (
    new.id,
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 40), ''),
    case when (new.raw_user_meta_data ->> 'privacy_accepted') = 'true' then now() end
  );
  return new;
end $$;

-- Reports: housemates also need older bills (beyond what the app loads by default). The existing
-- "members read bills" policies already cover this; no change needed.
