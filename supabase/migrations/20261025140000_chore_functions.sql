-- Phase 5: chores. Rules:
-- * Any member can add a chore and assign it to anyone in the household.
-- * Any member can tick a chore done (the app asks "Is it really done?" first) or undo it.
-- * Repeating chores (daily, weekly): ticking one done creates the next one, due one day/week
--   after the old due date (never in the past). Undo removes that next one again if it isn't done.
-- * The chore's creator or the household admin can delete it.

-- Links a repeating chore to the one it was created from (one "next" per chore)
alter table public.chores
  add column previous_id uuid unique references public.chores (id) on delete set null;

create function public.create_chore(
  p_household  uuid,
  p_title      text,
  p_emoji      text,
  p_assignee   uuid,
  p_due_date   date,
  p_recurrence text default 'none'
) returns uuid
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  today date;
  c uuid;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  if not public.is_member(p_household) then raise exception 'not_a_member'; end if;
  if char_length(btrim(coalesce(p_title, ''))) not between 1 and 60 then raise exception 'invalid_name'; end if;
  if p_recurrence not in ('none', 'daily', 'weekly') then raise exception 'invalid_option'; end if;
  if not exists (select 1 from public.household_members where household_id = p_household and user_id = p_assignee) then
    raise exception 'assignee_not_member';
  end if;
  today := public.household_today(p_household);
  if p_due_date is null or p_due_date < today - 365 or p_due_date > today + 366 then raise exception 'invalid_date'; end if;

  insert into public.chores (household_id, title, emoji, assignee_id, due_date, recurrence, created_by)
  values (p_household, btrim(p_title), nullif(p_emoji, ''), p_assignee, p_due_date, p_recurrence, uid)
  returning id into c;
  return c;
end $$;

create function public.complete_chore(p_chore uuid) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ch public.chores;
  next_due date;
  today date;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into ch from public.chores where id = p_chore for update;
  if not found or not public.is_member(ch.household_id) then raise exception 'not_found'; end if;
  if ch.done_at is not null then return; end if;

  update public.chores set done_at = now(), done_by = uid where id = p_chore;

  if ch.recurrence <> 'none' then
    today := public.household_today(ch.household_id);
    next_due := ch.due_date + case ch.recurrence when 'daily' then 1 else 7 end;
    if next_due < today then next_due := today; end if;
    insert into public.chores (household_id, title, emoji, assignee_id, due_date, recurrence, created_by, previous_id)
    values (ch.household_id, ch.title, ch.emoji, ch.assignee_id, next_due, ch.recurrence, ch.created_by, ch.id)
    on conflict (previous_id) do nothing;
  end if;
end $$;

create function public.reopen_chore(p_chore uuid) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ch public.chores;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into ch from public.chores where id = p_chore for update;
  if not found or not public.is_member(ch.household_id) then raise exception 'not_found'; end if;

  update public.chores set done_at = null, done_by = null where id = p_chore;
  -- Take back the next repeat if nobody has done it yet
  delete from public.chores where previous_id = p_chore and done_at is null;
end $$;

create function public.delete_chore(p_chore uuid) returns void
language plpgsql volatile security definer set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  ch public.chores;
begin
  if uid is null then raise exception 'not_signed_in'; end if;
  select * into ch from public.chores where id = p_chore;
  if not found or not public.is_member(ch.household_id) then raise exception 'not_found'; end if;
  if ch.created_by is distinct from uid and not public.is_owner(ch.household_id) then raise exception 'not_allowed'; end if;
  delete from public.chores where id = p_chore;
end $$;

revoke execute on function public.create_chore(uuid, text, text, uuid, date, text) from public, anon;
revoke execute on function public.complete_chore(uuid)                            from public, anon;
revoke execute on function public.reopen_chore(uuid)                              from public, anon;
revoke execute on function public.delete_chore(uuid)                              from public, anon;

grant execute on function public.create_chore(uuid, text, text, uuid, date, text) to authenticated;
grant execute on function public.complete_chore(uuid)                             to authenticated;
grant execute on function public.reopen_chore(uuid)                               to authenticated;
grant execute on function public.delete_chore(uuid)                               to authenticated;
