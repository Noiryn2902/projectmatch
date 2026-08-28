-- The open pool: the two halves of the product, connected.
--
-- Until now `people_read` let you see a person only if you shared a workspace
-- with them. That made ProjectMatch a staffing tool for one company, while the
-- landing page promised "describe the project, get the team" — someone who
-- filled in Find work landed in their own workspace and was invisible to
-- everyone with a brief.
--
-- This opens a second door, and the conditions on it are the whole design:
--
--   user_id is not null     they signed up themselves. Colleagues imported
--                           from somebody's spreadsheet never agreed to be
--                           visible platform-wide, and are NOT in the pool.
--   open_to_projects        the existing opt-out, now load-bearing.
--   visibility = 'org'      a person who set themselves private stays private.
--
-- So the pool is exactly: people who made an account, filled in a profile, and
-- did not say no. Everyone else keeps the old workspace-only rule.

create or replace function public.is_discoverable(
  p_user_id uuid,
  p_open boolean,
  p_visibility text
) returns boolean
language sql
immutable
as $$
  select p_user_id is not null and p_open and p_visibility = 'org';
$$;

comment on function public.is_discoverable is
  'A claimed, opted-in, non-private profile — matchable by anyone with a brief.';

drop policy if exists people_read on people;

create policy people_read on people for select
  using (
    deleted_at is null
    and (
      public.is_demo_org(org_id)
      or (
        public.is_org_member(org_id)
        and (visibility = 'org' or user_id = auth.uid() or public.is_org_admin(org_id))
      )
      -- The open pool. Signed-in callers only: this is not public data.
      or (
        auth.uid() is not null
        and public.is_discoverable(user_id, open_to_projects, visibility)
      )
    )
  );

-- Writing is untouched on purpose. Being matchable does not make you editable:
-- people_update still requires your own row or an admin of your workspace, so
-- a stranger can rank you and invite you and change nothing about you.
