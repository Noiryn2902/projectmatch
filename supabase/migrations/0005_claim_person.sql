-- Claiming a profile: attaching a signed-in account to a roster row.
--
-- Imported people carry a null user_id (see the partial unique index in
-- 0001). Someone signs in and says "that row is me" — but they cannot do it
-- with an ordinary update: people_update only lets through a row you already
-- own or one in an org you already admin. A member claiming their own
-- imported row is neither. Same shape as create_org's bootstrapping problem,
-- same fix: one SECURITY DEFINER function that does the single privileged
-- write and nothing more.
--
-- Guard rails, all enforced here:
--   - must be signed in and a member of the row's org
--   - the row must be unclaimed
--   - you must not already hold a claimed row in that org (the unique index
--     would reject it anyway; this returns a clean error instead)
--   - you must either be an admin of the org, or the row's email must match
--     your own — an admin can reconcile the roster, everyone else can only
--     claim themselves

create or replace function public.claim_person(p_person_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
  v_row_email text;
  v_row_user uuid;
  v_my_email text;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to claim a profile.';
  end if;

  select org_id, email, user_id into v_org_id, v_row_email, v_row_user
    from people where id = p_person_id and deleted_at is null;

  if v_org_id is null then
    raise exception 'No such person.';
  end if;
  if not public.is_org_member(v_org_id) then
    raise exception 'You are not a member of that organisation.';
  end if;
  if v_row_user is not null then
    raise exception 'That profile has already been claimed.';
  end if;
  if exists (
    select 1 from people
    where org_id = v_org_id and user_id = auth.uid() and deleted_at is null
  ) then
    raise exception 'You already have a profile in that organisation.';
  end if;

  select email into v_my_email from auth.users where id = auth.uid();

  if not public.is_org_admin(v_org_id)
     and (v_row_email is null or lower(v_row_email) is distinct from lower(v_my_email)) then
    raise exception 'You can only claim a profile whose email matches your own.';
  end if;

  update people
     set user_id = auth.uid(), claimed_at = now()
   where id = p_person_id;
end;
$$;

revoke execute on function public.claim_person(uuid) from public, anon;
grant execute on function public.claim_person(uuid) to authenticated;
