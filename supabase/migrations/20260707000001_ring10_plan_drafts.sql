-- ============================================================
-- Wild Wanderers — Ring 10.1a: plan drafts that rest
--
-- Forks the self-directed metadata from Team Esface
-- (20260601000011_self_directed_training.sql), coach side only for
-- this ring. A drafted plan can now rest as 'draft' instead of being
-- created-and-activated in one breath: who started it, whether Scout
-- drafted it and from what ask, and who approved it when it went live.
--
-- The client AI path is deliberately NOT forked (no client-facing
-- generation, per the Coach AI guardrail). Phase C (client
-- self-directed) adds its own policies in a later ring; the columns it
-- shares land here once so the table changes shape a single time.
--
-- Split in two files on purpose: this one adds the enum value, the
-- next one references it. Postgres cannot add an enum value and use it
-- in the same transaction.
-- ============================================================

-- Self-directed plans (Phase C) will submit for an optional review.
-- Added now so the status set is complete and stable.
alter type plan_status add value if not exists 'pending_review';

alter table training_plans
  -- Who started the plan. Coach-side always 'owner'/'coach'; 'client'
  -- is reserved for the self-directed ring.
  add column if not exists initiated_by user_role not null default 'coach'
    check (initiated_by in ('owner', 'coach', 'client')),
  -- Set when Scout drafted the plan, with the ask it worked from, so
  -- the drafts list can say so and Gabe can see what he asked for.
  -- Token and cost accounting stays in the sealed ai_calls ledger.
  add column if not exists ai_generated boolean not null default false,
  add column if not exists origin_prompt text,
  -- Stamped when a draft is activated: the explicit approval record
  -- beside the status flip. (Team Esface coach_approved_at/by.)
  add column if not exists coach_approved_at timestamptz,
  add column if not exists coach_approved_by uuid references profiles(id);
