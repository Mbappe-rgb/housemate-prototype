-- Phase 2 · 3/4: Row Level Security and permissions.
-- Default deny: every table has RLS on. The app can read its own household's rows.
-- The only direct write is a user editing their own profile. Every other write goes through
-- database functions added in Phases 3-5, which check the rules and run in one transaction.

-- ---------------------------------------------------------------------------
-- Helpers used by policies
-- ---------------------------------------------------------------------------

-- Is the signed-in user a member of this household?
create function public.is_member(h uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = h and m.user_id = (select auth.uid())
  );
$$;

-- Does the signed-in user share a household with this person? (Used to read housemates' profiles.)
create function public.shares_household(other uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.household_members me
    join public.household_members them on them.household_id = me.household_id
    where me.user_id = (select auth.uid()) and them.user_id = other
  );
$$;

-- ---------------------------------------------------------------------------
-- Function permissions: nothing is callable by anonymous visitors
-- ---------------------------------------------------------------------------
revoke execute on function public.is_member(uuid)               from public, anon;
revoke execute on function public.shares_household(uuid)        from public, anon;
grant  execute on function public.is_member(uuid)               to authenticated;
grant  execute on function public.shares_household(uuid)        to authenticated;

revoke execute on function public.handle_new_user()             from public, anon, authenticated;
revoke execute on function public.enforce_member_cap()          from public, anon, authenticated;
revoke execute on function public.check_bill_shares_total()     from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Table permissions: start from nothing, then grant only what the app needs
-- ---------------------------------------------------------------------------
revoke all on table
  public.profiles, public.households, public.household_members, public.invites,
  public.allowed_signups, public.bills, public.bill_shares, public.chores, public.reminders_sent
from anon, authenticated;

grant select on table
  public.profiles, public.households, public.household_members, public.invites,
  public.bills, public.bill_shares, public.chores
to authenticated;

-- Users may edit these profile columns (never id or created_at)
grant update (display_name, avatar_hue, etransfer_email, bank_name, phone, theme,
              notify_enabled, notify_bills, notify_chores)
  on public.profiles to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.households        enable row level security;
alter table public.household_members enable row level security;
alter table public.invites           enable row level security;
alter table public.allowed_signups   enable row level security;
alter table public.bills             enable row level security;
alter table public.bill_shares       enable row level security;
alter table public.chores            enable row level security;
alter table public.reminders_sent    enable row level security;

-- profiles: yourself and your housemates
create policy "read own and housemates' profiles" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.shares_household(id));

create policy "update own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- household data: members only
create policy "members read household" on public.households
  for select to authenticated using (public.is_member(id));

create policy "members read members" on public.household_members
  for select to authenticated using (public.is_member(household_id));

create policy "members read invites" on public.invites
  for select to authenticated using (public.is_member(household_id));

create policy "members read bills" on public.bills
  for select to authenticated using (public.is_member(household_id));

create policy "members read bill shares" on public.bill_shares
  for select to authenticated
  using (exists (
    select 1 from public.bills b
    where b.id = bill_id and public.is_member(b.household_id)
  ));

create policy "members read chores" on public.chores
  for select to authenticated using (public.is_member(household_id));

-- allowed_signups and reminders_sent: no app policies (only the auth hook / service role)
