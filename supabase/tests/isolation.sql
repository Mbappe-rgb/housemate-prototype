-- Two-account isolation and rule checks (implementation plan, section 11).
-- Needs the seed data. Run against DEV with:
--   npx supabase db query --linked -f supabase/tests/isolation.sql
-- Prints one row per check. Every write it attempts is rolled back, so it leaves no data behind.
--
-- People:  Ada + Ben in Maple House,  Cleo in Birch Flat,  plus an anonymous visitor.

create temp table results (n serial, check_name text, ok boolean, detail text);

-- Switch to a user (as_role 'authenticated' + uid), an anonymous visitor ('anon'),
-- or stay as the database admin ('postgres'). Settings are local to the current transaction.
create function pg_temp.become(as_role text, uid uuid) returns void language plpgsql as $$
begin
  if as_role = 'postgres' then return; end if;
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', as_role)::text, true);
  perform set_config('role', as_role, true);
end $$;

create function pg_temp.unbecome() returns void language plpgsql as $$
begin
  perform set_config('role', 'none', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

-- A query should return this number
create function pg_temp.expect_count(name text, as_role text, uid uuid, q text, expected bigint)
returns void language plpgsql as $$
declare n bigint; err text;
begin
  begin
    perform pg_temp.become(as_role, uid);
    execute q into n;
    perform pg_temp.unbecome();
  exception when others then
    err := sqlerrm;
  end;
  insert into results (check_name, ok, detail)
  values (name, err is null and n = expected,
          coalesce('error: ' || err, 'got ' || n || ', expected ' || expected));
end $$;

-- A statement should fail, with an error message containing `pattern`
create function pg_temp.expect_error(name text, as_role text, uid uuid, q text, pattern text)
returns void language plpgsql as $$
declare err text;
begin
  begin
    perform pg_temp.become(as_role, uid);
    execute q;
    raise exception 'UNEXPECTED_SUCCESS';
  exception when others then
    err := sqlerrm;
  end;
  insert into results (check_name, ok, detail)
  values (name, err <> 'UNEXPECTED_SUCCESS' and err ilike '%' || pattern || '%', err);
end $$;

-- A write should change exactly this many rows (then it is rolled back)
create function pg_temp.expect_rows(name text, as_role text, uid uuid, q text, expected bigint)
returns void language plpgsql as $$
declare n bigint; err text;
begin
  begin
    perform pg_temp.become(as_role, uid);
    execute q;
    get diagnostics n = row_count;
    raise exception 'ROLLBACK_ME';
  exception when others then
    if sqlerrm <> 'ROLLBACK_ME' then err := sqlerrm; end if;
  end;
  insert into results (check_name, ok, detail)
  values (name, err is null and n = expected,
          coalesce('error: ' || err, 'changed ' || n || ', expected ' || expected));
end $$;

do $$
declare
  ada   constant uuid := '11111111-1111-4111-8111-111111111111';
  ben   constant uuid := '22222222-2222-4222-8222-222222222222';
  cleo  constant uuid := '33333333-3333-4333-8333-333333333333';
  maple constant text := '''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa''';
  birch constant text := '''bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb''';
  a text := 'authenticated';
begin
  -- Cleo (Birch Flat) sees only Birch Flat
  perform pg_temp.expect_count('Cleo sees 1 household',        a, cleo, 'select count(*) from public.households', 1);
  perform pg_temp.expect_count('Cleo sees 1 member',           a, cleo, 'select count(*) from public.household_members', 1);
  perform pg_temp.expect_count('Cleo sees only her profile',   a, cleo, 'select count(*) from public.profiles', 1);
  perform pg_temp.expect_count('Cleo sees 1 bill',             a, cleo, 'select count(*) from public.bills', 1);
  perform pg_temp.expect_count('Cleo sees 1 bill share',       a, cleo, 'select count(*) from public.bill_shares', 1);
  perform pg_temp.expect_count('Cleo sees 1 chore',            a, cleo, 'select count(*) from public.chores', 1);
  perform pg_temp.expect_count('Cleo sees 0 invites',          a, cleo, 'select count(*) from public.invites', 0);
  perform pg_temp.expect_count('Cleo cannot fetch Maple by id', a, cleo,
    'select count(*) from public.households where id = ' || maple, 0);
  perform pg_temp.expect_count('Cleo cannot fetch Maple bill by id', a, cleo,
    'select count(*) from public.bills where id = ''aaaaaaaa-0000-4000-8000-0000000000b1''', 0);
  perform pg_temp.expect_count('Cleo cannot read Ada''s profile', a, cleo,
    'select count(*) from public.profiles where id = ''11111111-1111-4111-8111-111111111111''', 0);
  perform pg_temp.expect_count('is_member(Maple) is false for Cleo', a, cleo,
    'select count(*) from (select 1 where public.is_member(' || maple || ')) x', 0);

  -- Ben (Maple House) sees Maple House and his housemate
  perform pg_temp.expect_count('Ben sees 1 household',         a, ben, 'select count(*) from public.households', 1);
  perform pg_temp.expect_count('Ben sees 2 members',           a, ben, 'select count(*) from public.household_members', 2);
  perform pg_temp.expect_count('Ben sees 2 profiles',          a, ben, 'select count(*) from public.profiles', 2);
  perform pg_temp.expect_count('Ben sees 2 bills',             a, ben, 'select count(*) from public.bills', 2);
  perform pg_temp.expect_count('Ben sees 4 bill shares',       a, ben, 'select count(*) from public.bill_shares', 4);
  perform pg_temp.expect_count('Ben sees 1 chore',             a, ben, 'select count(*) from public.chores', 1);
  perform pg_temp.expect_count('Ben sees 1 invite',            a, ben, 'select count(*) from public.invites', 1);
  perform pg_temp.expect_count('Ben cannot fetch Birch by id', a, ben,
    'select count(*) from public.households where id = ' || birch, 0);

  -- Direct writes are blocked (writes go through functions in later phases)
  perform pg_temp.expect_error('Cleo cannot create a household', a, cleo,
    'insert into public.households (name) values (''Sneaky'')', 'permission denied');
  perform pg_temp.expect_error('Cleo cannot add herself to Maple', a, cleo,
    'insert into public.household_members (household_id, user_id) values (' || maple || ', auth.uid())', 'permission denied');
  perform pg_temp.expect_error('Ben cannot edit a bill', a, ben,
    'update public.bills set total_cents = 1', 'permission denied');
  perform pg_temp.expect_error('Ben cannot mark a share paid directly', a, ben,
    'update public.bill_shares set paid_at = now()', 'permission denied');
  perform pg_temp.expect_error('Ben cannot delete chores', a, ben,
    'delete from public.chores', 'permission denied');
  perform pg_temp.expect_error('Ben cannot create invites directly', a, ben,
    'insert into public.invites (household_id, token, kind, expires_at, max_uses) values (' || maple
      || ', ''ABCDEFGHJKLM'', ''link'', now() + interval ''1 day'', 1)', 'permission denied');
  perform pg_temp.expect_error('Users cannot read the signup allowlist', a, ben,
    'select count(*) from public.allowed_signups', 'permission denied');
  perform pg_temp.expect_error('Users cannot read reminders_sent', a, ben,
    'select count(*) from public.reminders_sent', 'permission denied');

  -- Profiles: edit your own, never someone else's, never the id
  perform pg_temp.expect_rows('Ben can rename himself', a, ben,
    'update public.profiles set display_name = ''Benny'' where id = auth.uid()', 1);
  perform pg_temp.expect_rows('Ben cannot rename Ada (0 rows)', a, ben,
    'update public.profiles set display_name = ''Hacked'' where id = ''11111111-1111-4111-8111-111111111111''', 0);
  perform pg_temp.expect_rows('Cleo cannot rename Ben (0 rows)', a, cleo,
    'update public.profiles set display_name = ''Hacked'' where id = ''22222222-2222-4222-8222-222222222222''', 0);
  perform pg_temp.expect_error('Ben cannot change his profile id', a, ben,
    'update public.profiles set id = gen_random_uuid() where id = auth.uid()', 'permission denied');
  perform pg_temp.expect_error('Profile name length is limited', a, ben,
    'update public.profiles set display_name = repeat(''x'', 41) where id = auth.uid()', 'check constraint');

  -- Anonymous visitors see nothing
  perform pg_temp.expect_error('Anon cannot read households', 'anon', null, 'select count(*) from public.households', 'permission denied');
  perform pg_temp.expect_error('Anon cannot read profiles',   'anon', null, 'select count(*) from public.profiles', 'permission denied');
  perform pg_temp.expect_error('Anon cannot read bills',      'anon', null, 'select count(*) from public.bills', 'permission denied');
  perform pg_temp.expect_error('Anon cannot read invites',    'anon', null, 'select count(*) from public.invites', 'permission denied');
  perform pg_temp.expect_error('Anon cannot call is_member',  'anon', null,
    'select public.is_member(' || maple || ')', 'permission denied');
  perform pg_temp.expect_error('Users cannot call the signup hook', a, ben,
    'select public.hook_before_user_created(''{}''::jsonb)', 'permission denied');

  -- Database rules (checked as admin, so only the constraints stop them)
  perform pg_temp.expect_error('One household per person', 'postgres', null,
    'insert into public.household_members (household_id, user_id) values (' || birch || ', ''22222222-2222-4222-8222-222222222222'')',
    'household_members_one_household');
  perform pg_temp.expect_error('One owner per household', 'postgres', null,
    'update public.household_members set role = ''owner'' where user_id = ''22222222-2222-4222-8222-222222222222''',
    'household_members_one_owner');
  perform pg_temp.expect_error('Invite tokens must use the safe alphabet', 'postgres', null,
    'insert into public.invites (household_id, token, kind, expires_at, max_uses) values (' || maple
      || ', ''ABC0OI1'', ''link'', now(), 1)', 'invites_token_check');
  perform pg_temp.expect_error('Money cannot be negative', 'postgres', null,
    'update public.bill_shares set amount_cents = -1 where bill_id = ''bbbbbbbb-0000-4000-8000-0000000000b1''',
    'bill_shares_amount_cents_check');

  -- Signup allowlist hook
  perform pg_temp.expect_count('Hook refuses an unlisted email', 'postgres', null,
    'select count(*) from (select 1 where public.hook_before_user_created(''{"user":{"email":"stranger@example.com"}}''::jsonb) ? ''error'') x', 1);
end $$;

-- Household cap: Maple House has 2 members, so 6 more fit and the 7th must be refused.
do $$
declare
  i int;
  new_id uuid;
  failed_at int;
  err text;
begin
  begin
    for i in 1..7 loop
      new_id := gen_random_uuid();
      insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at,
                              confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
              'cap' || i || '@seed.housemate.test', now(), now(), '', '', '', '');
      failed_at := i;
      insert into public.household_members (household_id, user_id)
      values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', new_id);
      failed_at := null;
    end loop;
    raise exception 'UNEXPECTED_SUCCESS';
  exception when others then
    err := sqlerrm;
  end;
  insert into results (check_name, ok, detail)
  values ('Household is capped at 8 members', err ilike '%household_full%' and failed_at = 7,
          err || ' (refused member #' || coalesce((failed_at + 2)::text, '?') || ')');
end $$;

-- Shares must add up to the bill total (normally checked at commit; forced immediate here)
do $$
declare err text;
begin
  begin
    set constraints all immediate;
    update public.bill_shares set amount_cents = amount_cents + 1
     where bill_id = 'aaaaaaaa-0000-4000-8000-0000000000b1'
       and user_id = '22222222-2222-4222-8222-222222222222';
    raise exception 'UNEXPECTED_SUCCESS';
  exception when others then
    err := sqlerrm;
  end;
  set constraints all deferred;
  insert into results (check_name, ok, detail)
  values ('Shares must add up to the bill total', err ilike '%shares_mismatch%', err);
end $$;

-- Hook lets a listed email through (inserted and removed inside a rolled-back block)
do $$
declare ok boolean; err text;
begin
  begin
    insert into public.allowed_signups (email) values ('tester@seed.housemate.test');
    ok := public.hook_before_user_created('{"user":{"email":"Tester@Seed.Housemate.test"}}'::jsonb) = '{}'::jsonb;
    raise exception 'ROLLBACK_ME';
  exception when others then
    if sqlerrm <> 'ROLLBACK_ME' then err := sqlerrm; end if;
  end;
  insert into results (check_name, ok, detail)
  values ('Hook allows a listed email (any case)', coalesce(ok, false) and err is null, coalesce(err, 'returned {} = ' || ok));
end $$;

select result, check_name, detail
from (
  select n, case when ok then 'PASS' else 'FAIL' end as result, check_name, detail
  from results
  union all
  select 1000000, '== ' || count(*) filter (where ok) || '/' || count(*) || ' passed ==', '', ''
  from results
) t
order by n;
