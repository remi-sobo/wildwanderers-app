-- ============================================================
-- Wild Wanderers — Ring 3: Coach AI ("Coach")
--
-- The observability ledgers for the AI layer, forked from Team Esface
-- (20260702000001_observability_ledger_audit.sql). We took audit_events
-- in Ring 2; this ring takes the other two:
--   * ai_calls — one row per Claude call from the chokepoint
--     (src/lib/ai/call.ts), with a static per-model cost estimate. The
--     monthly budget stop sums this table before every call.
--   * voice_violations — what the voice sweep caught (source, labels,
--     short excerpts). Model output only, never a client's input.
--
-- Both SEALED: RLS on with ZERO policies and every grant revoked, so no
-- app role (anon, authenticated) can read or write a row. The service
-- role, which bypasses RLS, is the only reader and writer, reached through
-- the admin chokepoint (src/lib/supabase/admin.ts), fire-and-forget.
--
-- No new domain tables. Coach writes plans as 'draft' into the existing
-- Ring 1 tables and fills check_ins.structured (Ring 2), all approved by
-- Gabe. Nothing here is client-facing.
-- ============================================================

-- ── ai_calls: the cost ledger ────────────────────────────────
create table ai_calls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  task text not null,
  model text not null,
  input_tokens int,
  output_tokens int,
  -- Estimated from the static price map in src/lib/ai/cost.ts; null when
  -- the model id has no known price.
  cost_usd numeric(10, 6),
  -- Who the call ran on behalf of, and their org. Ids only, never names
  -- or content.
  actor_id uuid,
  org_id uuid
);

create index ai_calls_org_created_idx on ai_calls (org_id, created_at);
create index ai_calls_created_idx on ai_calls (created_at);

alter table ai_calls enable row level security;
-- Sealed: zero policies, no direct grants. Service role only.
revoke all on table ai_calls from public, anon, authenticated;

-- ── voice_violations: the tone-drift log ─────────────────────
create table voice_violations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Where the text came from, e.g. 'coach.summary'.
  source text not null,
  -- Labels from violatesVoice(), e.g. '{em_dash}'.
  violations text[] not null,
  -- Model output excerpts (capped at the writer). Model text, never a
  -- client's input.
  raw_excerpt text,
  cleaned_excerpt text,
  retried boolean not null default false
);

alter table voice_violations enable row level security;
-- Sealed: zero policies, no direct grants. Service role only.
revoke all on table voice_violations from public, anon, authenticated;
