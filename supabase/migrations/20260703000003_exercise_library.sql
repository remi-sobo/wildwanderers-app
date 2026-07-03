-- ============================================================
-- Wild Wanderers — Ring 1.5: Exercise Library
--
-- A per-org database of movements that plan-building draws from
-- (and that Coach AI will draw from at Ring 3). Retargeted from the
-- Team Esface knowledge_base_items library. workout_exercises keeps
-- the per-client prescription and now references a library movement.
-- ============================================================

create table exercise_library (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  title text not null,
  kind exercise_kind not null default 'strength',
  muscle_group text,
  equipment text,
  media_url text,          -- demo video or gif
  instructions text,
  cues text,               -- coaching cues
  default_sets int,
  default_reps text,
  is_active boolean not null default true,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (org_id, title)
);
create index idx_exercise_library_org on exercise_library (org_id);
create index idx_exercise_library_kind on exercise_library (kind);

-- Wire the placeholder FK left on workout_exercises in Ring 1.
alter table workout_exercises
  add constraint workout_exercises_library_item_fk
  foreign key (library_item_id) references exercise_library(id) on delete set null;

alter table exercise_library enable row level security;

-- Owner and coach manage the library within their org.
create policy "staff_manage_exercise_library"
  on exercise_library for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

-- Clients can read active movements in their org (to view demos, and for
-- self-directed training later).
create policy "clients_read_active_exercise_library"
  on exercise_library for select
  using (org_id = get_user_org() and get_user_role() = 'client' and is_active);
