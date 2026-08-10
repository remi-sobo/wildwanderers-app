-- ============================================================
-- Wild Wanderers — Ring 4 follow-up: the lead popout
--
-- The pipeline board gains a per-lead workspace (details, timeline, notes,
-- and tasks in one panel). The only schema need: a task can belong to a
-- lead, mirroring the Team Esface business OS pattern where tasks carry
-- their source record. Owner-only RLS on business_tasks already covers the
-- new column; no policy change.
-- ============================================================

alter table business_tasks
  add column lead_id uuid references leads(id) on delete set null;

create index business_tasks_lead_idx on business_tasks (lead_id)
  where lead_id is not null;
