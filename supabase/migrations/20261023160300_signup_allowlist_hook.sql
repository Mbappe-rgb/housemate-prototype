-- Phase 2 · 4/4: invite-only signups for the demo.
-- Supabase calls this "Before User Created" hook before saving a new account.
-- Turn it on in the dashboard: Authentication > Hooks > Before User Created >
-- Postgres function > public.hook_before_user_created.
-- Add testers with:  insert into public.allowed_signups (email) values ('name@example.com');

create function public.hook_before_user_created(event jsonb) returns jsonb
language plpgsql stable set search_path = ''
as $$
declare
  signup_email text := lower(btrim(coalesce(event -> 'user' ->> 'email', '')));
begin
  if signup_email <> '' and exists (
    select 1 from public.allowed_signups where email = signup_email
  ) then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'This demo is invite-only.'
    )
  );
end $$;

-- Only the Auth service may run the hook or read the allowlist
revoke execute on function public.hook_before_user_created(jsonb) from public, anon, authenticated;
grant  execute on function public.hook_before_user_created(jsonb) to supabase_auth_admin;

grant usage on schema public to supabase_auth_admin;
grant select on table public.allowed_signups to supabase_auth_admin;

create policy "auth service reads allowlist" on public.allowed_signups
  for select to supabase_auth_admin using (true);
