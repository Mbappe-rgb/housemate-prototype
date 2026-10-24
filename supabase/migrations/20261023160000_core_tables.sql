-- Phase 2 · 1/4: people, households, membership, invites, signup allowlist.
-- Conventions: uuid keys, timestamptz times, text length limits, RLS turned on in 20261023160200.

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, created by a trigger on signup
-- ---------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  display_name     text check (display_name is null or char_length(btrim(display_name)) between 1 and 40),
  avatar_hue       smallint not null default floor(random() * 360)::smallint check (avatar_hue between 0 and 359),
  etransfer_email  text check (etransfer_email is null or char_length(etransfer_email) <= 254),
  bank_name        text check (bank_name is null or char_length(bank_name) <= 60),
  phone            text check (phone is null or char_length(phone) <= 30),
  theme            text not null default 'lime' check (theme in ('lime', 'sage', 'midnight', 'pop')),
  notify_enabled   boolean not null default true,
  notify_bills     boolean not null default true,
  notify_chores    boolean not null default true,
  created_at       timestamptz not null default now()
);

comment on table public.profiles is
  'Public-ish profile for each user. Payment fields are optional and only visible to housemates.';

-- Create the profile when a user signs up. The sign-up form passes display_name as user metadata.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(left(btrim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), 40), '')
  );
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Accounts created before this migration get a profile too
insert into public.profiles (id, display_name)
select u.id, nullif(left(btrim(coalesce(u.raw_user_meta_data ->> 'display_name', '')), 40), '')
from auth.users u
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- households and members
-- ---------------------------------------------------------------------------
create table public.households (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 1 and 60),
  created_by  uuid references public.profiles (id) on delete set null,
  timezone    text not null default 'America/Toronto' check (char_length(timezone) between 1 and 64),
  currency    text not null default 'CAD' check (currency ~ '^[A-Z]{3}$'),
  created_at  timestamptz not null default now()
);

create table public.household_members (
  household_id  uuid not null references public.households (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  role          text not null default 'member' check (role in ('owner', 'member')),
  joined_at     timestamptz not null default now(),
  primary key (household_id, user_id),
  -- MVP: one household per person
  constraint household_members_one_household unique (user_id)
);

-- At most one owner per household
create unique index household_members_one_owner
  on public.household_members (household_id) where role = 'owner';

-- Household size cap (8). Locks the household row so two joins can't race past the cap.
create function public.enforce_member_cap() returns trigger
language plpgsql set search_path = ''
as $$
begin
  perform 1 from public.households where id = new.household_id for update;
  if (select count(*) from public.household_members where household_id = new.household_id) >= 8 then
    raise exception 'household_full' using errcode = 'check_violation';
  end if;
  return new;
end $$;

create trigger household_members_cap
  before insert on public.household_members
  for each row execute function public.enforce_member_cap();

-- ---------------------------------------------------------------------------
-- invites (functions to create/accept them arrive in Phase 3)
-- ---------------------------------------------------------------------------
create table public.invites (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  -- 12-16 chars, no look-alikes (0/O, 1/I)
  token         text not null unique check (token ~ '^[A-HJ-NP-Z2-9]{12,16}$'),
  kind          text not null check (kind in ('link', 'email')),
  email         text check (email is null or char_length(email) <= 254),
  created_by    uuid references public.profiles (id) on delete set null,
  expires_at    timestamptz not null,
  max_uses      integer not null check (max_uses between 1 and 50),
  uses          integer not null default 0,
  revoked_at    timestamptz,
  created_at    timestamptz not null default now(),
  constraint invites_uses_range check (uses between 0 and max_uses),
  constraint invites_email_kind check ((kind = 'email') = (email is not null))
);

create index invites_household_id_idx on public.invites (household_id);

-- ---------------------------------------------------------------------------
-- allowed_signups: demo gate, read only by the auth hook (see 20261023160300)
-- ---------------------------------------------------------------------------
create table public.allowed_signups (
  email       text primary key check (email = lower(btrim(email)) and char_length(email) <= 254),
  note        text check (note is null or char_length(note) <= 200),
  created_at  timestamptz not null default now()
);

comment on table public.allowed_signups is
  'Tester emails allowed to sign up. Add rows from the dashboard or SQL editor. Not readable from the app.';
