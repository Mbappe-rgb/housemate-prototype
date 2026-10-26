-- Two-account isolation and rule checks (implementation plan, section 11).
-- Needs the seed data. Run against DEV with:
--   npx supabase db query --linked -f supabase/tests/isolation.sql
-- Prints one row per check. Every write it attempts is rolled back, so it leaves no data behind.
--
-- People:  Ada (admin) + Ben in Maple House,  Cleo in Birch Flat,  Dan with no household,
--          plus an anonymous visitor.

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

-- ---------------------------------------------------------------------------
-- Phase 3: invites and join requests (Dan has no household; Ada is Maple's admin)
-- Everything in this block is rolled back at the end.
-- ---------------------------------------------------------------------------
create function pg_temp.try(q text) returns text language plpgsql as $$
declare r text;
begin
  execute q into r;
  return 'ok:' || coalesce(r, 'null');
exception when others then
  return 'err:' || sqlerrm;
end $$;

do $$
declare
  ada   constant uuid := '11111111-1111-4111-8111-111111111111';
  ben   constant uuid := '22222222-2222-4222-8222-222222222222';
  cleo  constant uuid := '33333333-3333-4333-8333-333333333333';
  dan   constant uuid := '44444444-4444-4444-8444-444444444444';
  maple constant text := '''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa''';
  a text := 'authenticated';
  names text[] := '{}';
  oks boolean[] := '{}';
  details text[] := '{}';
  r text;
  req text;
  new_token text;

begin
  begin
    -- Anonymous visitor opens the invite link
    perform pg_temp.become('anon', null);
    r := pg_temp.try('select public.preview_invite(''k7qm-2xpd-9tcf'')::text');
    perform pg_temp.unbecome();
    names := array_append(names, 'Anyone can preview a valid invite (name + count only)'::text);
    oks := oks || (r like '%"status": "ok"%' and r like '%Maple House%' and r like '%"member_count": 2%' and r not like '%email%');
    details := details || r;

    perform pg_temp.become('anon', null);
    r := pg_temp.try('select public.preview_invite(''AAAA-BBBB-CCCC'')::text');
    names := array_append(names, 'Unknown invite shows as invalid'::text);
    oks := oks || (r = 'ok:{"status": "invalid"}');
    details := details || r;

    r := pg_temp.try('select public.request_to_join(''K7QM2XPD9TCF'')::text');
    perform pg_temp.unbecome();
    names := array_append(names, 'Anonymous visitors cannot request to join'::text);
    oks := oks || (r like 'err:permission denied%');
    details := details || r;

    -- Dan asks to join Maple House
    perform pg_temp.become(a, dan);
    req := pg_temp.try('select public.request_to_join(''K7QM-2XPD-9TCF'')::text');
    names := array_append(names, 'Signed-in person can request to join'::text);
    oks := oks || (req like 'ok:%' and req <> 'ok:null');
    details := details || req;

    r := pg_temp.try('select public.request_to_join(''K7QM2XPD9TCF'')::text');
    names := array_append(names, 'Asking twice reuses the same request'::text);
    oks := oks || (r = req);
    details := details || r;

    r := pg_temp.try('select public.my_join_request()->>''status'' || '' / '' || (public.my_join_request()->>''household_name'')');
    names := array_append(names, 'Requester sees their pending request'::text);
    oks := oks || (r = 'ok:pending / Maple House');
    details := details || r;

    r := pg_temp.try('select count(*)::text from public.households');
    perform pg_temp.unbecome();
    names := array_append(names, 'Requester cannot see the household before approval'::text);
    oks := oks || (r = 'ok:0');
    details := details || r;

    -- Only the admin sees and decides requests
    perform pg_temp.become(a, cleo);
    r := pg_temp.try('select count(*)::text from public.join_requests');
    perform pg_temp.unbecome();
    names := array_append(names, 'Other households cannot see the request'::text);
    oks := oks || (r = 'ok:0');
    details := details || r;

    perform pg_temp.become(a, ben);
    r := pg_temp.try('select count(*)::text from public.join_requests');
    names := array_append(names, 'Members who are not admin cannot see requests'::text);
    oks := oks || (r = 'ok:0');
    details := details || r;

    r := pg_temp.try('select count(*)::text from public.list_join_requests(' || maple || ')');
    names := array_append(names, 'Members who are not admin cannot list requests'::text);
    oks := oks || (r like 'err:not_admin%');
    details := details || r;

    r := pg_temp.try('select public.decide_join_request(' || quote_literal(substr(req, 4)) || ', true)');
    perform pg_temp.unbecome();
    names := array_append(names, 'Members who are not admin cannot approve'::text);
    oks := oks || (r like 'err:not_admin%');
    details := details || r;

    perform pg_temp.become(a, ada);
    r := pg_temp.try('select string_agg(display_name || '' <'' || email || ''>'', '','') from public.list_join_requests(' || maple || ')');
    names := array_append(names, 'Admin sees the request with name and email'::text);
    oks := oks || (r = 'ok:Dan <dan@seed.housemate.test>');
    details := details || r;

    r := pg_temp.try('select public.decide_join_request(' || quote_literal(substr(req, 4)) || ', true)');
    names := array_append(names, 'Admin can approve'::text);
    oks := oks || (r = 'ok:approved');
    details := details || r;

    r := pg_temp.try('select public.decide_join_request(' || quote_literal(substr(req, 4)) || ', false)');
    perform pg_temp.unbecome();
    names := array_append(names, 'A decided request cannot be decided again'::text);
    oks := oks || (r like 'err:request_closed%');
    details := details || r;

    perform pg_temp.become(a, dan);
    r := pg_temp.try('select string_agg(name, '','') from public.households');
    names := array_append(names, 'Approved person now sees the household'::text);
    oks := oks || (r = 'ok:Maple House');
    details := details || r;

    r := pg_temp.try('select coalesce(public.my_join_request()::text, ''none'')');
    perform pg_temp.unbecome();
    names := array_append(names, 'No pending request after approval'::text);
    oks := oks || (r = 'ok:none');
    details := details || r;

    -- Invite links
    perform pg_temp.become(a, ben);
    r := pg_temp.try('select public.get_invite_link(' || maple || ')');
    names := array_append(names, 'Any member can get the invite link'::text);
    oks := oks || (r = 'ok:K7QM2XPD9TCF');
    details := details || r;

    r := pg_temp.try('select public.reset_invite_link(' || maple || ')');
    perform pg_temp.unbecome();
    names := array_append(names, 'Only the admin can reset the link'::text);
    oks := oks || (r like 'err:not_admin%');
    details := details || r;

    perform pg_temp.become(a, ada);
    new_token := pg_temp.try('select public.reset_invite_link(' || maple || ')');
    r := pg_temp.try('select public.preview_invite(''K7QM2XPD9TCF'')->>''status''');
    perform pg_temp.unbecome();
    names := array_append(names, 'Resetting the link revokes the old one'::text);
    oks := oks || (new_token ~ '^ok:[A-HJ-NP-Z2-9]{12}$' and r = 'ok:revoked');
    details := details || (new_token || ' / old link: ' || r);

    perform pg_temp.become(a, cleo);
    r := pg_temp.try('select public.get_invite_link(' || maple || ')');
    names := array_append(names, 'Outsiders cannot get a household''s link'::text);
    oks := oks || (r like 'err:not_a_member%');
    details := details || r;

    r := pg_temp.try('select public.request_to_join(' || quote_literal(substr(new_token, 4)) || ')::text');
    perform pg_temp.unbecome();
    names := array_append(names, 'People already in a household cannot request'::text);
    oks := oks || (r like 'err:already_in_household%');
    details := details || r;

    -- Leaving and removing
    perform pg_temp.become(a, ada);
    r := pg_temp.try('select public.leave_household()::text');
    names := array_append(names, 'Admin must pick a new admin before leaving'::text);
    oks := oks || (r like 'err:choose_new_admin%');
    details := details || r;

    r := pg_temp.try('select public.create_household(''Second home'')::text');
    names := array_append(names, 'Cannot create a second household'::text);
    oks := oks || (r like 'err:already_in_household%');
    details := details || r;

    r := pg_temp.try('select public.remove_member(' || maple || ', ''22222222-2222-4222-8222-222222222222'')::text');
    names := array_append(names, 'Admin can remove a housemate'::text);
    oks := oks || (r = 'ok:');  -- void functions return an empty string
    details := details || r;

    r := pg_temp.try('select public.leave_household(''44444444-4444-4444-8444-444444444444'')::text');
    perform pg_temp.unbecome();
    names := array_append(names, 'Admin can leave by handing over to someone'::text);
    oks := oks || (r = 'ok:');  -- void functions return an empty string
    details := details || r;

    perform pg_temp.become(a, dan);
    r := pg_temp.try('select role from public.household_members where user_id = auth.uid()');
    perform pg_temp.unbecome();
    names := array_append(names, 'The new admin is now owner'::text);
    oks := oks || (r = 'ok:owner');
    details := details || r;

    raise exception 'ROLLBACK_ME';
  exception when others then
    if sqlerrm <> 'ROLLBACK_ME' then
      names := array_append(names, 'Phase 3 checks ran to the end'::text);
      oks := oks || false;
      details := details || sqlerrm;
    end if;
  end;

  for i in 1..coalesce(array_length(names, 1), 0) loop
    insert into results (check_name, ok, detail) values (names[i], oks[i], details[i]);
  end loop;
end $$;

-- Creating a household makes you its admin with an invite link (rolled back)
do $$
declare r text; role_ok boolean; link_ok boolean; err text;
begin
  begin
    perform pg_temp.become('authenticated', '44444444-4444-4444-8444-444444444444');
    r := public.create_household('  Dan''s place  ')::text;
    select m.role = 'owner' into role_ok from public.household_members m where m.user_id = auth.uid();
    select count(*) = 1 into link_ok from public.invites where household_id = r::uuid and kind = 'link';
    perform pg_temp.unbecome();
    raise exception 'ROLLBACK_ME';
  exception when others then
    if sqlerrm <> 'ROLLBACK_ME' then err := sqlerrm; end if;
  end;
  insert into results (check_name, ok, detail)
  values ('Creator becomes admin and gets an invite link', err is null and role_ok and link_ok,
          coalesce('error: ' || err, 'owner=' || role_ok || ', link=' || link_ok));
end $$;

-- ---------------------------------------------------------------------------
-- Phase 4: bills (Maple House: Ada is admin; Internet = Ada pays, Ada paid, Ben not;
-- Hydro = Ben created and pays, $100.01 split 5001/5000, nothing paid). All rolled back.
-- ---------------------------------------------------------------------------
do $$
declare
  ada   constant uuid := '11111111-1111-4111-8111-111111111111';
  ben   constant uuid := '22222222-2222-4222-8222-222222222222';
  cleo  constant uuid := '33333333-3333-4333-8333-333333333333';
  maple constant text := '''aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa''';
  internet constant text := '''aaaaaaaa-0000-4000-8000-0000000000b1''';
  hydro constant text := '''aaaaaaaa-0000-4000-8000-0000000000b2''';
  a text := 'authenticated';
  names text[] := '{}';
  oks boolean[] := '{}';
  details text[] := '{}';
  r text;
  bid text;
  i int;
begin
  begin
    -- Adding bills
    perform pg_temp.become(a, ben);
    bid := pg_temp.try('select public.create_bill(' || maple || ', ''Gas'', ''Gas'', ''🔥'', 10001, current_date + 3, auth.uid())::text');
    r := pg_temp.try('select string_agg(amount_cents::text, ''/'' order by amount_cents desc) from public.bill_shares where bill_id = '
                     || quote_literal(substr(bid, 4)));
    names := array_append(names, 'Equal split: extra cent goes to the earliest member'::text);
    oks := oks || (bid like 'ok:%' and r = 'ok:5001/5000');
    details := details || (bid || ' shares ' || r);

    r := pg_temp.try('select public.create_bill(' || maple || ', ''Gas'', ''Gas'', null, 1000, current_date, auth.uid(), ''none'', ''custom'', '
                     || quote_literal(jsonb_build_object(ada::text, 600, ben::text, 300)::text) || '::jsonb)::text');
    names := array_append(names, 'Custom split must add up to the total'::text);
    oks := oks || (r like 'err:split_mismatch%');
    details := details || r;

    r := pg_temp.try('select public.create_bill(' || maple || ', ''Gas'', ''Gas'', null, 1000, current_date, auth.uid(), ''none'', ''custom'', '
                     || quote_literal(jsonb_build_object(ada::text, 700, ben::text, 300)::text) || '::jsonb)::text');
    names := array_append(names, 'Custom split that adds up is accepted'::text);
    oks := oks || (r like 'ok:%' and r <> 'ok:null');
    details := details || r;

    r := pg_temp.try('select public.create_bill(' || maple || ', ''Gas'', ''Gas'', null, 1000, current_date, '
                     || quote_literal(cleo::text) || ')::text');
    names := array_append(names, 'Payer must be in the household'::text);
    oks := oks || (r like 'err:payer_not_member%');
    details := details || r;

    r := pg_temp.try('select public.create_bill(' || maple || ', ''Gas'', ''Gas'', null, 0, current_date, auth.uid())::text');
    perform pg_temp.unbecome();
    names := array_append(names, 'Bill total must be more than $0'::text);
    oks := oks || (r like 'err:invalid_amount%');
    details := details || r;

    perform pg_temp.become(a, cleo);
    r := pg_temp.try('select public.create_bill(' || maple || ', ''Sneaky'', ''Other'', null, 1000, current_date, auth.uid())::text');
    perform pg_temp.unbecome();
    names := array_append(names, 'Outsiders cannot add bills to a household'::text);
    oks := oks || (r like 'err:not_a_member%');
    details := details || r;

    perform pg_temp.become('anon', null);
    r := pg_temp.try('select public.create_bill(' || maple || ', ''Sneaky'', ''Other'', null, 1000, current_date, null)::text');
    perform pg_temp.unbecome();
    names := array_append(names, 'Anonymous visitors cannot add bills'::text);
    oks := oks || (r like 'err:permission denied%');
    details := details || r;

    -- Marking paid
    perform pg_temp.become(a, ben);
    r := pg_temp.try('select public.set_share_paid(' || internet || ', auth.uid(), true)::text');
    names := array_append(names, 'You can mark your own share paid'::text);
    oks := oks || (r = 'ok:');
    details := details || r;

    r := pg_temp.try('select public.set_share_paid(' || hydro || ', ' || quote_literal(ada::text) || ', true)::text');
    names := array_append(names, 'The payer can mark someone''s share received'::text);
    oks := oks || (r = 'ok:');
    details := details || r;

    r := pg_temp.try('select public.set_share_paid(' || internet || ', ' || quote_literal(ada::text) || ', false)::text');
    perform pg_temp.unbecome();
    names := array_append(names, 'Others cannot change someone else''s payment'::text);
    oks := oks || (r like 'err:not_allowed%');
    details := details || r;

    perform pg_temp.become(a, cleo);
    r := pg_temp.try('select public.set_share_paid(' || internet || ', ' || quote_literal(ben::text) || ', false)::text');
    perform pg_temp.unbecome();
    names := array_append(names, 'Outsiders cannot touch a household''s bills'::text);
    oks := oks || (r like 'err:not_found%');
    details := details || r;

    -- Editing the split (Hydro now has Ada's share paid, so it's locked)
    perform pg_temp.become(a, ada);
    r := pg_temp.try('select public.update_bill_split(' || hydro || ', ''equal'')::text');
    perform pg_temp.unbecome();
    names := array_append(names, 'Only the creator can edit the split'::text);
    oks := oks || (r like 'err:not_creator%');
    details := details || r;

    perform pg_temp.become(a, ben);
    r := pg_temp.try('select public.update_bill_split(' || hydro || ', ''custom'', '
                     || quote_literal(jsonb_build_object(ada::text, 6001, ben::text, 4000)::text) || '::jsonb)::text');
    names := array_append(names, 'Split is locked once a housemate has paid'::text);
    oks := oks || (r like 'err:split_locked%');
    details := details || r;

    -- Undo Ada's payment, then the creator can change the split
    r := pg_temp.try('select public.set_share_paid(' || hydro || ', ' || quote_literal(ada::text) || ', false)::text');
    r := pg_temp.try('select public.update_bill_split(' || hydro || ', ''custom'', '
                     || quote_literal(jsonb_build_object(ada::text, 6001, ben::text, 4000)::text) || '::jsonb)::text');
    names := array_append(names, 'Creator can edit the split while unlocked'::text);
    oks := oks || (r = 'ok:');
    details := details || r;

    -- Settings: payer change
    r := pg_temp.try('select public.update_bill_settings(' || internet || ', auth.uid(), ''monthly'')::text');
    perform pg_temp.unbecome();
    names := array_append(names, 'Only the creator or admin can change the payer'::text);
    oks := oks || (r like 'err:not_allowed%');
    details := details || r;

    perform pg_temp.become(a, ada);
    r := pg_temp.try('select public.update_bill_settings(' || internet || ', ' || quote_literal(ben::text) || ', ''monthly'')::text');
    r := r || ' / paid now: ' || pg_temp.try('select count(*)::text from public.bill_shares where paid_at is not null and bill_id = ' || internet);
    names := array_append(names, 'Changing the payer clears every payment'::text);
    oks := oks || (r = 'ok: / paid now: ok:0');
    details := details || r;

    -- Deleting
    r := pg_temp.try('select public.set_share_paid(' || internet || ', ' || quote_literal(ada::text) || ', true)::text');
    r := pg_temp.try('select public.delete_bill(' || internet || ')::text');
    names := array_append(names, 'Bills with payments cannot be deleted'::text);
    oks := oks || (r like 'err:bill_has_payments%');
    details := details || r;
    perform pg_temp.unbecome();

    perform pg_temp.become(a, ben);
    r := pg_temp.try('select public.delete_bill(' || hydro || ')::text');
    perform pg_temp.unbecome();
    names := array_append(names, 'Creator can delete an unpaid bill'::text);
    oks := oks || (r = 'ok:');
    details := details || r;

    -- Monthly bills roll forward (due 40 days ago -> next two months, then nothing)
    perform pg_temp.become(a, ada);
    bid := pg_temp.try('select public.create_bill(' || maple || ', ''Phone'', ''Phone'', ''📱'', 9000, current_date - 40, auth.uid(), ''monthly'')::text');
    r := pg_temp.try('select public.roll_recurring_bills(' || maple || ')::text');
    r := r || ' then ' || pg_temp.try('select public.roll_recurring_bills(' || maple || ')::text');
    r := r || ' / ' || pg_temp.try('select count(*)::text || '' bills, '' || count(*) filter (where recurrence = ''monthly'')::text || '' repeating'' from public.bills where series_id = '
                                   || quote_literal(substr(bid, 4)));
    perform pg_temp.unbecome();
    names := array_append(names, 'Monthly bills add the next months, once'::text);
    oks := oks || (r = 'ok:2 then ok:0 / ok:3 bills, 1 repeating');
    details := details || r;

    raise exception 'ROLLBACK_ME';
  exception when others then
    if sqlerrm <> 'ROLLBACK_ME' then
      names := array_append(names, 'Phase 4 checks ran to the end'::text);
      oks := oks || false;
      details := details || sqlerrm;
    end if;
  end;

  for i in 1..coalesce(array_length(names, 1), 0) loop
    insert into results (check_name, ok, detail) values (names[i], oks[i], details[i]);
  end loop;
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
