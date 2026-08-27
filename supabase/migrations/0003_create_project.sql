-- Turning a brief into a persisted project touches four tables — projects,
-- project_roles, requirements, seats — and a partial write (the project row
-- lands, a role insert then fails) is a worse outcome than the write failing
-- outright. One function call is one transaction, so either all of it lands
-- or none of it does.
--
-- Unlike create_org() in 0002, this one is plain SECURITY INVOKER — there is
-- no bootstrapping deadlock to work around here. The caller is already a
-- member of the org by the time they can reach this (Phase 1 established
-- that), so ordinary RLS on projects/project_roles/requirements/seats is
-- exactly the check that should run on every insert this function makes, and
-- leaving it as invoker is what makes that true. A non-member's call fails
-- the same way a raw insert from them would.

create or replace function public.create_project(
  p_org_id uuid,
  p_name text,
  p_brief_text text,
  p_duration_weeks int,
  p_domain text[],
  p_roles jsonb -- [{title, hoursNeeded, requirements: [{skillId, minLevel, weight}]}]
) returns uuid
language plpgsql
as $$
declare
  v_project_id uuid;
  v_role jsonb;
  v_role_id uuid;
  v_req jsonb;
  v_position int := 0;
begin
  insert into projects (org_id, name, brief_text, duration_weeks, domain, status)
  values (p_org_id, p_name, p_brief_text, p_duration_weeks, p_domain, 'staffing')
  returning id into v_project_id;

  for v_role in select * from jsonb_array_elements(p_roles) loop
    insert into project_roles (project_id, title, hours_needed, position)
    values (
      v_project_id,
      v_role->>'title',
      coalesce((v_role->>'hoursNeeded')::int, 10),
      v_position
    )
    returning id into v_role_id;
    v_position := v_position + 1;

    -- Every role gets a seat, open, the moment the role exists — a role
    -- without a seat is not a state this schema should be able to represent.
    insert into seats (project_id, role_id, state)
    values (v_project_id, v_role_id, 'open');

    for v_req in select * from jsonb_array_elements(coalesce(v_role->'requirements', '[]'::jsonb)) loop
      insert into requirements (role_id, skill_id, min_level, weight)
      values (
        v_role_id,
        v_req->>'skillId',
        coalesce((v_req->>'minLevel')::int, 3),
        coalesce((v_req->>'weight')::int, 1)
      );
    end loop;
  end loop;

  return v_project_id;
end;
$$;

revoke execute on function public.create_project(uuid, text, text, int, text[], jsonb) from public, anon;
grant execute on function public.create_project(uuid, text, text, int, text[], jsonb) to authenticated;
