-- Personal details a person expects to be asked for, and to be able to fix.
--
-- Three columns, none of them read by the ranking engine. That is the whole
-- point of putting them here rather than threading them through scoring: a
-- profile that shows only what the algorithm consumes reads like a form for
-- the machine, and people do not trust a profile they cannot correct.
--
-- `not null default ''` matches how title, office and qualification are
-- already modelled, so every existing read path keeps working with no
-- coalesce and no backfill.

alter table people add column if not exists phone   text not null default '';
alter table people add column if not exists address text not null default '';
alter table people add column if not exists gender  text not null default '';

comment on column people.phone is
  'Free text, shown on the profile. Not read by the ranking engine.';

comment on column people.address is
  'Free text, optional. Never required, and never used for matching or filtering.';

-- Deliberately free text with an empty default rather than an enum or a
-- check constraint. A fixed list of genders is a list that is wrong for
-- somebody, and this field exists to be displayed at its owner's choosing --
-- it is not aggregated, not filtered on, and not an input to any decision the
-- product makes. Empty is the default and stays empty unless someone types
-- into it.
comment on column people.gender is
  'Optional self-description. Never inferred, never required, never used for matching.';
