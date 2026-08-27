-- What someone studied, alongside what they can do.
--
-- Deliberately one free-text line rather than a degrees table. A structured
-- education model — institution, field, start and end year, honours — is a
-- lot of schema to carry for something the engine never reads: ranking is
-- driven by levelled skills, not by where someone went to university, and
-- that is a property of this product worth keeping rather than eroding.
--
-- So this exists to be *shown* on a profile, because a person filling one in
-- expects to state their qualification and it looks unfinished without it.
-- If it ever needs to be queried or filtered, promote it then, with the
-- benefit of knowing what people actually typed.
--
-- `not null default ''` matches how title, office and department are already
-- modelled here, so every read path keeps working without a coalesce.

alter table people add column if not exists qualification text not null default '';

comment on column people.qualification is
  'Free text, shown on the profile. Not read by the ranking engine.';
