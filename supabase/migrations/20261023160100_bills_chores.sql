-- Phase 2 · 2/4: bills, bill shares, chores, reminder log.
-- Money is integer cents. Dates are real dates. The write functions arrive in Phases 4 and 5.

-- ---------------------------------------------------------------------------
-- bills
-- ---------------------------------------------------------------------------
create table public.bills (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  name          text not null check (char_length(btrim(name)) between 1 and 60),
  category      text not null default 'other' check (char_length(category) between 1 and 30),
  emoji         text check (emoji is null or char_length(emoji) <= 8),
  total_cents   integer not null check (total_cents between 1 and 100000000),
  due_date      date not null,
  payer_id      uuid references public.profiles (id) on delete set null,
  created_by    uuid references public.profiles (id) on delete set null,
  recurrence    text not null default 'none' check (recurrence in ('none', 'monthly')),
  series_id     uuid,
  split_mode    text not null default 'equal' check (split_mode in ('equal', 'custom')),
  created_at    timestamptz not null default now()
);

create index bills_household_due_idx on public.bills (household_id, due_date);
create index bills_payer_id_idx      on public.bills (payer_id);
create index bills_series_id_idx     on public.bills (series_id) where series_id is not null;

-- ---------------------------------------------------------------------------
-- bill_shares: one row per member per bill
-- For the payer's own row, paid_at means "I paid the provider".
-- ---------------------------------------------------------------------------
create table public.bill_shares (
  bill_id       uuid not null references public.bills (id) on delete cascade,
  user_id       uuid not null references public.profiles (id),
  amount_cents  integer not null check (amount_cents >= 0),
  paid_at       timestamptz,
  marked_by     uuid references public.profiles (id) on delete set null,
  receipt_path  text check (receipt_path is null or char_length(receipt_path) <= 300),
  created_at    timestamptz not null default now(),
  primary key (bill_id, user_id)
);

create index bill_shares_user_id_idx on public.bill_shares (user_id);

-- Shares must add up to the bill total. Checked at the end of the transaction,
-- so a function can insert the bill and its shares together.
create function public.check_bill_shares_total() returns trigger
language plpgsql set search_path = ''
as $$
declare
  b_id   uuid;
  total  integer;
  shares bigint;
begin
  if tg_table_name = 'bills' then
    b_id := new.id;
  elsif tg_op = 'DELETE' then
    b_id := old.bill_id;
  else
    b_id := new.bill_id;
  end if;

  select total_cents into total from public.bills where id = b_id;
  if not found then
    return null; -- bill was deleted; its shares cascade away
  end if;
  select coalesce(sum(amount_cents), 0) into shares from public.bill_shares where bill_id = b_id;
  if shares <> total then
    raise exception 'shares_mismatch: shares % <> total % for bill %', shares, total, b_id
      using errcode = 'check_violation';
  end if;
  return null;
end $$;

create constraint trigger bills_shares_total
  after insert or update of total_cents on public.bills
  deferrable initially deferred
  for each row execute function public.check_bill_shares_total();

create constraint trigger bill_shares_total
  after insert or update or delete on public.bill_shares
  deferrable initially deferred
  for each row execute function public.check_bill_shares_total();

-- ---------------------------------------------------------------------------
-- chores
-- ---------------------------------------------------------------------------
create table public.chores (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households (id) on delete cascade,
  title         text not null check (char_length(btrim(title)) between 1 and 60),
  emoji         text check (emoji is null or char_length(emoji) <= 8),
  assignee_id   uuid references public.profiles (id) on delete set null,
  due_date      date not null,
  recurrence    text not null default 'none' check (recurrence in ('none', 'daily', 'weekly')),
  done_at       timestamptz,
  done_by       uuid references public.profiles (id) on delete set null,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint chores_done_by_needs_done_at check (done_by is null or done_at is not null)
);

create index chores_household_due_idx on public.chores (household_id, due_date);
create index chores_assignee_id_idx   on public.chores (assignee_id);

-- ---------------------------------------------------------------------------
-- reminders_sent: stops duplicate reminder emails (used in Phase 7)
-- ---------------------------------------------------------------------------
create table public.reminders_sent (
  id          uuid primary key default gen_random_uuid(),
  kind        text not null check (kind in ('bill_due', 'chore_due', 'invite')),
  entity_id   uuid not null,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  sent_at     timestamptz not null default now(),
  created_at  timestamptz not null default now()
);

create index reminders_sent_lookup_idx on public.reminders_sent (kind, entity_id, user_id);
