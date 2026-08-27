-- Fixes a bootstrapping deadlock in 0001: memberships_write requires the
-- caller to already be an admin of the org, which means nobody could ever
-- become the founding member of an org they just created — there is no
-- admin yet to grant that first membership.
--
-- The standard fix, and the same pattern is_org_member() already uses:
-- a SECURITY DEFINER function that inserts the org and its first membership
-- in one atomic step, bypassing RLS for exactly this one bootstrapping
-- moment. Anything after this — inviting a second person, editing the org —
-- goes through ordinary RLS-checked writes as normal.

create or replace function public.create_org(p_name text, p_slug text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Must be signed in to create an organisation.';
  end if;

  insert into orgs (name, slug, is_demo, created_by)
  values (p_name, p_slug, false, auth.uid())
  returning id into v_org_id;

  insert into memberships (org_id, user_id, role)
  values (v_org_id, auth.uid(), 'owner');

  return v_org_id;
end;
$$;

-- Signing in is required to act. A signed-out visitor has no auth.uid(), so
-- the function already refuses them — this just stops them calling it at all.
revoke execute on function public.create_org(text, text) from public, anon;
grant execute on function public.create_org(text, text) to authenticated;
