-- ProjectMatch — initial schema.
--
-- Two principles run through this file:
--
--   1. An organisation is the security boundary. Almost every policy below
--      resolves to "is the caller a member of the org this row belongs to".
--   2. Demo data is isolated at the query level, not by convention. The seeded
--      sixty live in an org with is_demo = true, which is readable by anyone
--      (including signed-out visitors, so the product can be looked at without
--      an account) and writable by nobody.
--
-- Authorisation is enforced server-side in the application. RLS here is
-- defence in depth, not the only gate.

-- ---------------------------------------------------------------------------
-- Organisations and membership
--
-- Created before the helper functions below, on purpose: those functions
-- query orgs and memberships, and a LANGUAGE SQL function is parsed and
-- validated against real tables at CREATE FUNCTION time, not deferred to
-- first call the way a PL/pgSQL body effectively is. Defining the functions
-- first, as the file originally did, fails migration with "relation
-- memberships does not exist" — order matters here.
-- ---------------------------------------------------------------------------

create table orgs (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  offices     text[] not null default '{}',
  is_demo     boolean not null default false,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table memberships (
  org_id      uuid not null references orgs(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null check (role in ('owner', 'admin', 'member')),
  created_at  timestamptz not null default now(),
  primary key (org_id, user_id)
);

create index memberships_user_idx on memberships(user_id);

-- ---------------------------------------------------------------------------
-- Helpers
--
-- These are SECURITY DEFINER on purpose. A policy on memberships that reads
-- memberships would recurse; routing the lookup through a definer function
-- breaks the cycle. search_path is pinned so the function body cannot be
-- redirected at a shadowed table.
-- ---------------------------------------------------------------------------

create or replace function public.is_org_member(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.org_id = target_org and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_admin(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from memberships m
    where m.org_id = target_org
      and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_demo_org(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from orgs o where o.id = target_org and o.is_demo);
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- The skill vocabulary
--
-- Global rather than per-org, and deliberately so: the engine's similarity
-- graph and every AI extraction are constrained to exactly these 82 entries.
-- An org inventing its own skill ids would break both.
-- ---------------------------------------------------------------------------

create table skills (
  id       text primary key,
  label    text not null,
  parent   text references skills(id),
  aliases  text[] not null default '{}',
  related  text[] not null default '{}'
);

-- ---------------------------------------------------------------------------
-- People
--
-- user_id is null until the person claims their imported profile. That is the
-- whole point of a roster import: the org describes people who have not signed
-- up yet, and each of them can later take ownership of their own row.
-- ---------------------------------------------------------------------------

create table people (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references orgs(id) on delete cascade,
  user_id           uuid references auth.users(id) on delete set null,
  name              text not null,
  title             text not null default '',
  office            text not null default '',
  -- A grouping inside the org. The seeded data's six companies become
  -- departments of the demo org, which keeps the scope filter meaningful
  -- without splitting sixty people into six pools too small to staff from.
  department        text not null default '',
  utc_offset        numeric(3,1) not null default 0,
  years_exp         int not null default 0 check (years_exp >= 0),
  seniority         int not null default 1 check (seniority between 1 and 5),
  hours_per_week    int not null default 0 check (hours_per_week >= 0),
  interests         text[] not null default '{}',
  email             text,
  slack             text,
  linkedin          text,
  github            text,
  photo             text,
  hue               int not null default 0,
  open_to_projects  boolean not null default true,
  visibility        text not null default 'org' check (visibility in ('org', 'private')),
  claimed_at        timestamptz,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- One person row per user per org. Partial, because imported people share the
-- null user_id until they claim.
create unique index people_org_user_idx on people(org_id, user_id) where user_id is not null;
create index people_org_idx on people(org_id) where deleted_at is null;

create trigger people_updated_at before update on people
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Skill records
--
-- provenance and last_used_at are the two fields that keep the engine honest.
-- A level means nothing without knowing who asserted it and how long ago the
-- skill was actually used, and the scoring discounts what it cannot verify.
-- ---------------------------------------------------------------------------

create table person_skills (
  id            uuid primary key default gen_random_uuid(),
  person_id     uuid not null references people(id) on delete cascade,
  skill_id      text not null references skills(id),
  level         int not null check (level between 1 and 5),
  provenance    text not null default 'self'
                  check (provenance in ('self', 'extracted', 'endorsed', 'verified')),
  source        text,
  last_used_at  date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (person_id, skill_id)
);

create index person_skills_person_idx on person_skills(person_id);
create index person_skills_skill_idx on person_skills(skill_id);

create trigger person_skills_updated_at before update on person_skills
  for each row execute function public.set_updated_at();

create table endorsements (
  id               uuid primary key default gen_random_uuid(),
  person_skill_id  uuid not null references person_skills(id) on delete cascade,
  endorsed_by      uuid not null references people(id) on delete cascade,
  note             text,
  created_at       timestamptz not null default now(),
  unique (person_skill_id, endorsed_by)
);

-- ---------------------------------------------------------------------------
-- Projects, roles, requirements, seats
-- ---------------------------------------------------------------------------

create table projects (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references orgs(id) on delete cascade,
  created_by      uuid references auth.users(id) on delete set null,
  name            text not null default '',
  brief_text      text not null,
  duration_weeks  int not null default 6 check (duration_weeks > 0),
  domain          text[] not null default '{}',
  budget_hours    int check (budget_hours is null or budget_hours > 0),
  status          text not null default 'draft'
                    check (status in ('draft', 'staffing', 'active', 'closed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index projects_org_idx on projects(org_id);

create trigger projects_updated_at before update on projects
  for each row execute function public.set_updated_at();

create table project_roles (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  title         text not null,
  hours_needed  int not null default 10 check (hours_needed > 0),
  position      int not null default 0
);

create index project_roles_project_idx on project_roles(project_id);

create table requirements (
  id         uuid primary key default gen_random_uuid(),
  role_id    uuid not null references project_roles(id) on delete cascade,
  skill_id   text not null references skills(id),
  min_level  int not null check (min_level between 1 and 5),
  weight     int not null default 1 check (weight > 0)
);

create index requirements_role_idx on requirements(role_id);

-- One seat per role, matching the engine's TeamState shape.
-- locked supports pinning a person and re-optimising around them.
create table seats (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  role_id     uuid not null references project_roles(id) on delete cascade unique,
  person_id   uuid references people(id) on delete set null,
  state       text not null default 'open' check (state in ('open', 'invited', 'filled')),
  locked      boolean not null default false,
  filled_at   timestamptz
);

create index seats_project_idx on seats(project_id);

-- ---------------------------------------------------------------------------
-- Allocation
--
-- The difference between "has twenty hours a week" and "has twenty hours a
-- week that are not already spent". project_id is nullable so commitments
-- outside ProjectMatch can be recorded too — most of a real person's time is
-- committed somewhere this product cannot see.
-- ---------------------------------------------------------------------------

create table allocations (
  id              uuid primary key default gen_random_uuid(),
  person_id       uuid not null references people(id) on delete cascade,
  project_id      uuid references projects(id) on delete cascade,
  label           text,
  hours_per_week  int not null check (hours_per_week > 0),
  starts_on       date,
  ends_on         date,
  created_at      timestamptz not null default now(),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index allocations_person_idx on allocations(person_id);

-- ---------------------------------------------------------------------------
-- Invitations
--
-- The token is what makes an invitation link work before the recipient has an
-- account. Accepting is handled server-side, so no policy here needs to serve
-- an anonymous token lookup.
-- ---------------------------------------------------------------------------

create table invitations (
  id            uuid primary key default gen_random_uuid(),
  seat_id       uuid not null references seats(id) on delete cascade,
  person_id     uuid not null references people(id) on delete cascade,
  invited_by    uuid references auth.users(id) on delete set null,
  token         text not null unique,
  status        text not null default 'pending'
                  check (status in ('pending', 'accepted', 'declined', 'expired', 'revoked')),
  message       text,
  sent_at       timestamptz not null default now(),
  responded_at  timestamptz,
  expires_at    timestamptz not null default (now() + interval '14 days')
);

-- A seat can only have one invitation outstanding at a time. This is the
-- "second person invites the same candidate" case, handled by the database
-- rather than by hoping the application checks first.
create unique index invitations_one_pending_per_seat
  on invitations(seat_id) where status = 'pending';

create index invitations_person_idx on invitations(person_id);

-- ---------------------------------------------------------------------------
-- Workspace chat
-- ---------------------------------------------------------------------------

create table messages (
  id           bigint generated always as identity primary key,
  project_id   uuid not null references projects(id) on delete cascade,
  author_id    uuid references people(id) on delete set null,
  author_name  text not null,
  body         text not null check (length(body) between 1 and 4000),
  at           timestamptz not null default now()
);

create index messages_project_idx on messages(project_id, at);

-- ---------------------------------------------------------------------------
-- Outcomes and audit
--
-- Outcomes are what turn this from a calculator into a system: acceptance and
-- completion are real events, and arithmetic over them feeds future ranking.
-- No model, so results stay reproducible.
-- ---------------------------------------------------------------------------

create table outcomes (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects(id) on delete cascade,
  person_id         uuid not null references people(id) on delete cascade,
  accepted          boolean,
  completed         boolean,
  would_work_again  boolean,
  recorded_at       timestamptz not null default now(),
  unique (project_id, person_id)
);

create table audit_log (
  id            bigint generated always as identity primary key,
  org_id        uuid references orgs(id) on delete cascade,
  actor_id      uuid references auth.users(id) on delete set null,
  action        text not null,
  subject_type  text,
  subject_id    text,
  payload       jsonb not null default '{}',
  at            timestamptz not null default now()
);

create index audit_log_org_idx on audit_log(org_id, at desc);

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table orgs          enable row level security;
alter table memberships   enable row level security;
alter table skills        enable row level security;
alter table people        enable row level security;
alter table person_skills enable row level security;
alter table endorsements  enable row level security;
alter table projects      enable row level security;
alter table project_roles enable row level security;
alter table requirements  enable row level security;
alter table seats         enable row level security;
alter table allocations   enable row level security;
alter table invitations   enable row level security;
alter table messages      enable row level security;
alter table outcomes      enable row level security;
alter table audit_log     enable row level security;

-- Orgs -----------------------------------------------------------------------

create policy orgs_read on orgs for select
  using (is_demo or public.is_org_member(id));

create policy orgs_create on orgs for insert to authenticated
  with check (created_by = auth.uid() and not is_demo);

create policy orgs_update on orgs for update
  using (public.is_org_admin(id) and not is_demo)
  with check (not is_demo);

-- Memberships ----------------------------------------------------------------

create policy memberships_read on memberships for select
  using (user_id = auth.uid() or public.is_org_member(org_id));

create policy memberships_write on memberships for all
  using (public.is_org_admin(org_id))
  with check (public.is_org_admin(org_id));

-- Skills ---------------------------------------------------------------------
-- Readable by everyone including signed-out visitors; the vocabulary is not
-- secret and the landing page needs it. Only migrations write here.

create policy skills_read on skills for select using (true);

-- People ---------------------------------------------------------------------

create policy people_read on people for select
  using (
    deleted_at is null
    and (
      public.is_demo_org(org_id)
      or (
        public.is_org_member(org_id)
        and (visibility = 'org' or user_id = auth.uid() or public.is_org_admin(org_id))
      )
    )
  );

create policy people_insert on people for insert to authenticated
  with check (
    not public.is_demo_org(org_id)
    and (
      public.is_org_admin(org_id)
      or (public.is_org_member(org_id) and user_id = auth.uid())
    )
  );

create policy people_update on people for update
  using (
    not public.is_demo_org(org_id)
    and (user_id = auth.uid() or public.is_org_admin(org_id))
  );

-- Person skills --------------------------------------------------------------

create policy person_skills_read on person_skills for select
  using (exists (select 1 from people p where p.id = person_id));

create policy person_skills_write on person_skills for all to authenticated
  using (
    exists (
      select 1 from people p
      where p.id = person_id
        and not public.is_demo_org(p.org_id)
        and (p.user_id = auth.uid() or public.is_org_admin(p.org_id))
    )
  )
  with check (
    exists (
      select 1 from people p
      where p.id = person_id
        and not public.is_demo_org(p.org_id)
        and (p.user_id = auth.uid() or public.is_org_admin(p.org_id))
    )
  );

-- Endorsements ---------------------------------------------------------------
-- You cannot endorse your own skill. That is the entire value of an endorsement.

create policy endorsements_read on endorsements for select
  using (exists (select 1 from person_skills ps where ps.id = person_skill_id));

create policy endorsements_write on endorsements for insert to authenticated
  with check (
    exists (
      select 1 from people me
      where me.id = endorsed_by and me.user_id = auth.uid()
    )
    and not exists (
      select 1 from person_skills ps
      join people subject on subject.id = ps.person_id
      where ps.id = person_skill_id and subject.user_id = auth.uid()
    )
  );

-- Projects and their children ------------------------------------------------

create policy projects_read on projects for select
  using (public.is_demo_org(org_id) or public.is_org_member(org_id));

create policy projects_write on projects for all to authenticated
  using (public.is_org_member(org_id) and not public.is_demo_org(org_id))
  with check (public.is_org_member(org_id) and not public.is_demo_org(org_id));

create policy project_roles_all on project_roles for all
  using (exists (select 1 from projects p where p.id = project_id))
  with check (exists (
    select 1 from projects p
    where p.id = project_id and public.is_org_member(p.org_id) and not public.is_demo_org(p.org_id)
  ));

create policy requirements_all on requirements for all
  using (exists (select 1 from project_roles r where r.id = role_id))
  with check (exists (
    select 1 from project_roles r
    join projects p on p.id = r.project_id
    where r.id = role_id and public.is_org_member(p.org_id) and not public.is_demo_org(p.org_id)
  ));

create policy seats_all on seats for all
  using (exists (select 1 from projects p where p.id = project_id))
  with check (exists (
    select 1 from projects p
    where p.id = project_id and public.is_org_member(p.org_id) and not public.is_demo_org(p.org_id)
  ));

-- Allocations ----------------------------------------------------------------

create policy allocations_read on allocations for select
  using (exists (select 1 from people p where p.id = person_id));

create policy allocations_write on allocations for all to authenticated
  using (exists (
    select 1 from people p
    where p.id = person_id and public.is_org_member(p.org_id) and not public.is_demo_org(p.org_id)
  ))
  with check (exists (
    select 1 from people p
    where p.id = person_id and public.is_org_member(p.org_id) and not public.is_demo_org(p.org_id)
  ));

-- Invitations ----------------------------------------------------------------
-- The invitee can always see their own invitation; the staffing side sees the
-- ones attached to their project.

create policy invitations_read on invitations for select
  using (
    exists (select 1 from people p where p.id = person_id and p.user_id = auth.uid())
    or exists (
      select 1 from seats s
      join projects p on p.id = s.project_id
      where s.id = seat_id and public.is_org_member(p.org_id)
    )
  );

create policy invitations_write on invitations for all to authenticated
  using (exists (
    select 1 from seats s
    join projects p on p.id = s.project_id
    where s.id = seat_id and public.is_org_member(p.org_id) and not public.is_demo_org(p.org_id)
  ))
  with check (exists (
    select 1 from seats s
    join projects p on p.id = s.project_id
    where s.id = seat_id and public.is_org_member(p.org_id) and not public.is_demo_org(p.org_id)
  ));

-- Messages -------------------------------------------------------------------

create policy messages_read on messages for select
  using (exists (
    select 1 from projects p
    where p.id = project_id and (public.is_demo_org(p.org_id) or public.is_org_member(p.org_id))
  ));

create policy messages_insert on messages for insert to authenticated
  with check (exists (
    select 1 from projects p
    where p.id = project_id and public.is_org_member(p.org_id) and not public.is_demo_org(p.org_id)
  ));

-- Outcomes -------------------------------------------------------------------

create policy outcomes_read on outcomes for select
  using (exists (select 1 from projects p where p.id = project_id));

create policy outcomes_write on outcomes for all to authenticated
  using (exists (
    select 1 from projects p
    where p.id = project_id and public.is_org_member(p.org_id) and not public.is_demo_org(p.org_id)
  ))
  with check (exists (
    select 1 from projects p
    where p.id = project_id and public.is_org_member(p.org_id) and not public.is_demo_org(p.org_id)
  ));

-- Audit log ------------------------------------------------------------------
-- Readable by admins, written only by the server. An audit trail an actor can
-- edit is not an audit trail.

create policy audit_log_read on audit_log for select
  using (public.is_org_admin(org_id));
