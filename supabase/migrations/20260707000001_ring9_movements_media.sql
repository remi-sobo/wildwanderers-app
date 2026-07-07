-- ============================================================
-- Wild Wanderers — Ring 9: Movements manager and real video
--
-- Gabe gets to edit the exercise library himself and attach real video. The
-- table (exercise_library, Ring 1.5) already carries media_url ("demo video or
-- gif") and staff-manage / client-read RLS. This phase only adds ordering and a
-- place to host uploaded clips. No policy change: the new column and bucket ride
-- the existing boundaries.
--
--   * sort_order      — lets Gabe arrange his movements; list and picker order
--                       by (sort_order, title). Backfilled off the current
--                       alphabetical order so nothing jumps on first load.
--   * exercise-media  — a public Storage bucket for uploaded demo clips. Public
--                       for the same reason as library-covers: a generic
--                       movement demo carries no personal or health data.
--                       Uploads are staff-minted server-side (Phase 5); public
--                       read is the bucket's job.
-- ============================================================

-- ── ordering ───────────────────────────────────────────────
alter table exercise_library
  add column if not exists sort_order int not null default 0;

-- Backfill: number the existing movements per org by title so the manager opens
-- in a stable, sensible order. New movements default to 0 and sort to the top
-- until Gabe arranges them, which is the intended "add it, then place it" flow.
with ordered as (
  select id,
         row_number() over (partition by org_id order by title) as rn
  from exercise_library
)
update exercise_library e
set sort_order = ordered.rn
from ordered
where ordered.id = e.id;

create index if not exists idx_exercise_library_org_sort
  on exercise_library (org_id, sort_order, title);

-- ── uploaded demo clips ────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('exercise-media', 'exercise-media', true)
on conflict (id) do nothing;
