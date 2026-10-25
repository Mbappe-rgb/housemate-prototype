-- Fake data for the DEV project only. Never run against prod.
-- Run with:  npx supabase db query --linked -f supabase/seed.sql
-- Safe to re-run: every insert skips rows that already exist.
--
-- Two households so the isolation test can check that they can't see each other:
--   Maple House: Ada (owner), Ben
--   Birch Flat:  Cleo (owner)
--   Dan:         no household yet
-- Seed users have NO password, so nobody can log in as them. Sign up with your own
-- allowlisted email to try the app.

begin;

-- Auth users (the profile trigger creates their profiles)
insert into auth.users (
  instance_id, id, aud, role, email, raw_user_meta_data, raw_app_meta_data,
  email_confirmed_at, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000', '11111111-1111-4111-8111-111111111111', 'authenticated', 'authenticated',
   'ada@seed.housemate.test', '{"display_name":"Ada"}', '{"provider":"email","providers":["email"]}',
   now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '22222222-2222-4222-8222-222222222222', 'authenticated', 'authenticated',
   'ben@seed.housemate.test', '{"display_name":"Ben"}', '{"provider":"email","providers":["email"]}',
   now(), now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000000', '33333333-3333-4333-8333-333333333333', 'authenticated', 'authenticated',
   'cleo@seed.housemate.test', '{"display_name":"Cleo"}', '{"provider":"email","providers":["email"]}',
   now(), now(), now(), '', '', '', ''),
  -- Dan has no household yet (used to test join requests)
  ('00000000-0000-0000-0000-000000000000', '44444444-4444-4444-8444-444444444444', 'authenticated', 'authenticated',
   'dan@seed.housemate.test', '{"display_name":"Dan"}', '{"provider":"email","providers":["email"]}',
   now(), now(), now(), '', '', '', '')
on conflict (id) do nothing;

-- Households
insert into public.households (id, name, created_by) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Maple House', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Birch Flat',  '33333333-3333-4333-8333-333333333333')
on conflict (id) do nothing;

insert into public.household_members (household_id, user_id, role, joined_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'owner',  now() - interval '30 days'),
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '22222222-2222-4222-8222-222222222222', 'member', now() - interval '20 days'),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '33333333-3333-4333-8333-333333333333', 'owner',  now() - interval '10 days')
on conflict do nothing;

-- Invite for Maple House (shown as K7QM-2XPD-9TCF)
insert into public.invites (id, household_id, token, kind, created_by, expires_at, max_uses) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'K7QM2XPD9TCF', 'link',
   '11111111-1111-4111-8111-111111111111', now() + interval '7 days', 10)
on conflict (id) do nothing;

-- Bills (shares must add up to the total; extra cents go to the earliest member)
insert into public.bills (id, household_id, name, category, emoji, total_cents, due_date, payer_id, created_by, recurrence) values
  ('aaaaaaaa-0000-4000-8000-0000000000b1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Internet', 'utilities', '📶',
   8000, current_date + 5, '11111111-1111-4111-8111-111111111111', '11111111-1111-4111-8111-111111111111', 'monthly'),
  ('aaaaaaaa-0000-4000-8000-0000000000b2', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Hydro', 'utilities', '💡',
   10001, current_date + 12, '22222222-2222-4222-8222-222222222222', '22222222-2222-4222-8222-222222222222', 'none'),
  ('bbbbbbbb-0000-4000-8000-0000000000b1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Rent', 'housing', '🏠',
   120000, current_date + 8, '33333333-3333-4333-8333-333333333333', '33333333-3333-4333-8333-333333333333', 'monthly')
on conflict (id) do nothing;

insert into public.bill_shares (bill_id, user_id, amount_cents, paid_at, marked_by) values
  ('aaaaaaaa-0000-4000-8000-0000000000b1', '11111111-1111-4111-8111-111111111111', 4000, now(), '11111111-1111-4111-8111-111111111111'),
  ('aaaaaaaa-0000-4000-8000-0000000000b1', '22222222-2222-4222-8222-222222222222', 4000, null, null),
  ('aaaaaaaa-0000-4000-8000-0000000000b2', '11111111-1111-4111-8111-111111111111', 5001, null, null),
  ('aaaaaaaa-0000-4000-8000-0000000000b2', '22222222-2222-4222-8222-222222222222', 5000, null, null),
  ('bbbbbbbb-0000-4000-8000-0000000000b1', '33333333-3333-4333-8333-333333333333', 120000, null, null)
on conflict do nothing;

-- Chores
insert into public.chores (id, household_id, title, emoji, assignee_id, due_date, recurrence, created_by) values
  ('aaaaaaaa-0000-4000-8000-0000000000c1', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Take out recycling', '♻️',
   '22222222-2222-4222-8222-222222222222', current_date, 'weekly', '11111111-1111-4111-8111-111111111111'),
  ('bbbbbbbb-0000-4000-8000-0000000000c1', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Vacuum hallway', '🧹',
   '33333333-3333-4333-8333-333333333333', current_date + 1, 'none', '33333333-3333-4333-8333-333333333333')
on conflict (id) do nothing;

commit;
