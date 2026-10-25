-- Phase 3: households, invite links and join requests with admin approval.
--
-- Rules (decided 2026-10-24, see docs/decisions.md):
-- * Whoever creates a household is its owner, shown as "Admin".
-- * Anyone with an invite link or code can ASK to join, but only after signing in.
-- * The admin approves or declines each request. Approving adds them as a member.
-- * One household per person, max 8 members, one pending request per person.
-- * Invite links last 7 days. Any member can share the link; only the admin can reset it.
-- * Email notifications come later (Phase 7); for now requests show on the admin's dashboard.
--
-- Every write below goes through a SECURITY DEFINER function that checks these rules,
-- and none of them is callable by anonymous visitors except preview_invite.

-- ---------------------------------------------------------------------------
-- join_requests
-- ---------------------------------------------------------------------------
create table public.join_requests (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references public.households (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  invite_id        uuid references public.invites (id) on delete set null,
  status           text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  decided_by       uuid references public.profiles (id) on delete set null,
  decided_at       timestamptz,
  acknowledged_at  timestamptz,
  created_at       timestamptz not null default now()
);

-- One pending request per person
create unique index join_requests_one_pending on public.join_requests (user_id) where status = 'pending';
create index join_requests_household_status_idx on public.join_requests (household_id, status);

alter table public.join_requests enable row level security;
revoke all on table public.join_requests from anon, authenticated;
grant select on table public.join_requests to authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Is the signed-in user the owner (admin) of this household?
create function public.is_owner(h uuid) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = h and m.user_id = (select auth.uid()) and m.role = 'owner'
  );
$$;

revoke execute on function public.is_owner(uuid) from public, anon;
grant execute on function public.is_owner(uuid) to authenticated;

create policy "requester or admin reads join requests" on public.join_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_owner(household_id));

-- 12 characters from a 32-letter alphabet without look-alikes (no 0/O, 1/I): 60 random bits.
-- 256 is a multiple of 32, so "byte % 32" picks every letter equally often.
create function public.generate_invite_token() returns text
language plpgsql volatile set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(12);
  token text := '';
  i int;
begin
  for i in 0..11 loop
    token := token || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return token;
end $$;

revoke execute on function public.generate_invite_token() from public, anon, authenticated;

-- Create a fresh 7-day link invite (internal; callers check permissions)
create function public.new_link_invite(h uuid, creator uuid) returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  t text;
  attempt int := 0;
begin
  loop
    attempt := attempt + 1;
    t := public.generate_invite_token();
    begin
      insert into public.invites (household_id, token, kind, created_by, expires_at, max_uses)
      values (h, t, 'link', creator, now() + interval '7 days', 50);
      return t;
    exception when unique_violation then
      if attempt >= 5 then raise; end if;
    end;
  end loop;
end $$;

revoke execute on function public.new_link_invite(uuid, uuid) from public, anon, authenticated;

-- An invite is usable if it isn't revoked, expired or used up
create function public.invite_status(inv public.invites) returns text
language sql stable set search_path = ''
as $$
  select case
    when inv.revoked_at is not null then 'revoked'
    when inv.expires_at < now() then 'expired'
    when inv.uses >= inv.max_uses then 'used_up'
    else 'ok'
  end;
$$;

revoke execute on function public.invite_status(public.invites) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- create_household: the creator becomes the owner (admin) and gets a first invite link
-- ---------------------------------------------------------------------------
create function public.create_household(p_name text, p_timezone text default 'America/Toronto')
returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  clean_name text := btrim(coalesce(p_name, ''));
  tz text := coalesce(nullif(btrim(p_timezone), ''), 'America/Toronto');
  h uuid;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if char_length(clean_name) not between 1 and 60 then raise exception 'invalid_name'; end if;
  if exists (select 1 from public.household_members where user_id = uid) then
    raise exception 'already_in_household';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = tz) then
    tz := 'America/Toronto';
  end if;

  -- Creating a household replaces any request to join another one
  update public.join_requests set status = 'cancelled', decided_at = now()
   where user_id = uid and status = 'pending';

  insert into public.households (name, created_by, timezone)
  values (clean_name, uid, tz)
  returning id into h;

  insert into public.household_members (household_id, user_id, role)
  values (h, uid, 'owner');

  perform public.new_link_invite(h, uid);
  return h;
end $$;

-- ---------------------------------------------------------------------------
-- Invite links
-- ---------------------------------------------------------------------------

-- The household's current link (creates one if none is active). Any member may share it.
create function public.get_invite_link(p_household uuid) returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  t text;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if not public.is_member(p_household) then raise exception 'not_a_member'; end if;

  select i.token into t
    from public.invites i
   where i.household_id = p_household and i.kind = 'link' and public.invite_status(i) = 'ok'
   order by i.created_at desc
   limit 1;

  return coalesce(t, public.new_link_invite(p_household, uid));
end $$;

-- "Reset link": revoke every active link and make a new one. Admin only.
create function public.reset_invite_link(p_household uuid) returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if not public.is_owner(p_household) then raise exception 'not_admin'; end if;

  update public.invites set revoked_at = now()
   where household_id = p_household and kind = 'link' and revoked_at is null;

  return public.new_link_invite(p_household, uid);
end $$;

-- What someone sees when they open /join/TOKEN, before or after signing in.
-- Returns only the household name, member count and initials; nothing else.
create function public.preview_invite(p_token text) returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  inv public.invites;
  st text;
  members jsonb;
  n int;
begin
  select * into inv from public.invites
   where token = upper(regexp_replace(coalesce(p_token, ''), '[\s-]', '', 'g'));
  if not found then
    return jsonb_build_object('status', 'invalid');
  end if;

  st := public.invite_status(inv);
  if st <> 'ok' then
    return jsonb_build_object('status', st);
  end if;

  select count(*),
         coalesce(jsonb_agg(jsonb_build_object(
           'initial', upper(left(coalesce(p.display_name, '?'), 1)),
           'hue', p.avatar_hue) order by m.joined_at) filter (where m.rn <= 4), '[]'::jsonb)
    into n, members
    from (select *, row_number() over (order by joined_at) as rn
            from public.household_members where household_id = inv.household_id) m
    join public.profiles p on p.id = m.user_id;

  return jsonb_build_object(
    'status', case when n >= 8 then 'full' else 'ok' end,
    'household_id', inv.household_id,
    'household_name', (select name from public.households where id = inv.household_id),
    'member_count', n,
    'members', members
  );
end $$;

-- ---------------------------------------------------------------------------
-- Join requests
-- ---------------------------------------------------------------------------

-- Ask to join with an invite token. Returns the request id.
create function public.request_to_join(p_token text) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  inv public.invites;
  existing uuid;
  req uuid;
begin
  if uid is null then raise exception 'not_signed_in'; end if;

  select * into inv from public.invites
   where token = upper(regexp_replace(coalesce(p_token, ''), '[\s-]', '', 'g'))
   for update;
  if not found or public.invite_status(inv) <> 'ok' then
    raise exception 'invite_invalid';
  end if;

  if exists (select 1 from public.household_members where user_id = uid) then
    raise exception 'already_in_household';
  end if;

  if (select count(*) from public.household_members where household_id = inv.household_id) >= 8 then
    raise exception 'household_full';
  end if;

  -- Already waiting on this household: nothing to do
  select id into existing from public.join_requests
   where user_id = uid and household_id = inv.household_id and status = 'pending';
  if found then return existing; end if;

  -- One pending request at a time: a new request replaces one for another household
  update public.join_requests set status = 'cancelled', decided_at = now()
   where user_id = uid and status = 'pending';

  insert into public.join_requests (household_id, user_id, invite_id)
  values (inv.household_id, uid, inv.id)
  returning id into req;

  update public.invites set uses = uses + 1 where id = inv.id;
  return req;
end $$;

-- The signed-in person's current request: pending, or declined and not yet seen.
create function public.my_join_request() returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'id', r.id,
    'status', r.status,
    'household_name', h.name,
    'created_at', r.created_at
  )
  from public.join_requests r
  join public.households h on h.id = r.household_id
  where r.user_id = (select auth.uid())
    and (r.status = 'pending' or (r.status = 'declined' and r.acknowledged_at is null))
  order by r.created_at desc
  limit 1;
$$;

-- Requester cancels their pending request
create function public.cancel_join_request() returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  update public.join_requests set status = 'cancelled', decided_at = now()
   where user_id = uid and status = 'pending';
end $$;

-- Requester has seen "your request was declined"
create function public.acknowledge_join_request(p_request uuid) returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'not_signed_in'; end if;
  update public.join_requests set acknowledged_at = now()
   where id = p_request and user_id = (select auth.uid()) and status = 'declined';
end $$;

-- Pending requests for the admin's dashboard (name, avatar colour and email of each requester)
create function public.list_join_requests(p_household uuid)
returns table (id uuid, user_id uuid, display_name text, avatar_hue smallint, email text, created_at timestamptz)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_owner(p_household) then raise exception 'not_admin'; end if;
  return query
    select r.id, r.user_id, p.display_name, p.avatar_hue, u.email::text, r.created_at
      from public.join_requests r
      join public.profiles p on p.id = r.user_id
      join auth.users u on u.id = r.user_id
     where r.household_id = p_household and r.status = 'pending'
     order by r.created_at;
end $$;

-- Admin approves (adds them as a member) or declines a request.
-- Returns 'approved', 'declined', or 'requester_in_household' if they joined somewhere else meanwhile.
create function public.decide_join_request(p_request uuid, p_approve boolean) returns text
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  req public.join_requests;
begin
  if uid is null then raise exception 'not_signed_in'; end if;

  select * into req from public.join_requests where id = p_request for update;
  if not found or not public.is_owner(req.household_id) then raise exception 'not_admin'; end if;
  if req.status <> 'pending' then raise exception 'request_closed'; end if;

  if p_approve then
    if exists (select 1 from public.household_members where user_id = req.user_id) then
      update public.join_requests set status = 'cancelled', decided_at = now(), decided_by = uid where id = req.id;
      return 'requester_in_household';
    end if;
    -- the member-cap trigger raises household_full if there's no room
    insert into public.household_members (household_id, user_id, role)
    values (req.household_id, req.user_id, 'member');
  end if;

  update public.join_requests
     set status = case when p_approve then 'approved' else 'declined' end,
         decided_at = now(),
         decided_by = uid
   where id = req.id;
  return case when p_approve then 'approved' else 'declined' end;
end $$;

-- ---------------------------------------------------------------------------
-- Leaving and removing
-- ---------------------------------------------------------------------------

-- Leave your household. The admin must name a new admin if others remain;
-- the last person leaving closes the household (deletes it and its data).
create function public.leave_household(p_new_admin uuid default null) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  me public.household_members;
  others int;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into me from public.household_members where user_id = uid for update;
  if not found then raise exception 'not_a_member'; end if;

  select count(*) into others from public.household_members
   where household_id = me.household_id and user_id <> uid;

  if others = 0 then
    delete from public.households where id = me.household_id;
    return;
  end if;

  if me.role = 'owner' then
    if p_new_admin is null or p_new_admin = uid or not exists (
      select 1 from public.household_members where household_id = me.household_id and user_id = p_new_admin
    ) then
      raise exception 'choose_new_admin';
    end if;
    delete from public.household_members where household_id = me.household_id and user_id = uid;
    update public.household_members set role = 'owner'
     where household_id = me.household_id and user_id = p_new_admin;
  else
    delete from public.household_members where household_id = me.household_id and user_id = uid;
  end if;
end $$;

-- Admin removes a housemate
create function public.remove_member(p_household uuid, p_user uuid) returns void
language plpgsql volatile security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'not_signed_in'; end if;
  if not public.is_owner(p_household) then raise exception 'not_admin'; end if;
  if p_user = (select auth.uid()) then raise exception 'cannot_remove_self'; end if;
  delete from public.household_members where household_id = p_household and user_id = p_user;
  if not found then raise exception 'not_a_member'; end if;
end $$;

-- ---------------------------------------------------------------------------
-- Who can call what
-- ---------------------------------------------------------------------------
revoke execute on function public.create_household(text, text)         from public, anon;
revoke execute on function public.get_invite_link(uuid)                from public, anon;
revoke execute on function public.reset_invite_link(uuid)              from public, anon;
revoke execute on function public.request_to_join(text)                from public, anon;
revoke execute on function public.my_join_request()                    from public, anon;
revoke execute on function public.cancel_join_request()                from public, anon;
revoke execute on function public.acknowledge_join_request(uuid)       from public, anon;
revoke execute on function public.list_join_requests(uuid)             from public, anon;
revoke execute on function public.decide_join_request(uuid, boolean)   from public, anon;
revoke execute on function public.leave_household(uuid)                from public, anon;
revoke execute on function public.remove_member(uuid, uuid)            from public, anon;

grant execute on function public.create_household(text, text)          to authenticated;
grant execute on function public.get_invite_link(uuid)                 to authenticated;
grant execute on function public.reset_invite_link(uuid)               to authenticated;
grant execute on function public.request_to_join(text)                 to authenticated;
grant execute on function public.my_join_request()                     to authenticated;
grant execute on function public.cancel_join_request()                 to authenticated;
grant execute on function public.acknowledge_join_request(uuid)        to authenticated;
grant execute on function public.list_join_requests(uuid)              to authenticated;
grant execute on function public.decide_join_request(uuid, boolean)    to authenticated;
grant execute on function public.leave_household(uuid)                 to authenticated;
grant execute on function public.remove_member(uuid, uuid)             to authenticated;

-- The one function anonymous visitors may call: the invite preview
revoke execute on function public.preview_invite(text) from public;
grant  execute on function public.preview_invite(text) to anon, authenticated;
