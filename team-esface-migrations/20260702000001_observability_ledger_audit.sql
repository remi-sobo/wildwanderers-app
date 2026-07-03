-- ============================================================
-- SPRINT B (Ring 6) -- observability: cost ledger, voice log, audit trail
-- ============================================================
-- Three jobs this migration does:
--
--  * ai_calls: month-to-date AI spend becomes a query. The AI
--    chokepoint (src/lib/ai/call.ts) writes one row per Claude call,
--    best-effort, with a static per-model price estimate. The monthly
--    budget stop (AI_MONTHLY_BUDGET_USD, src/lib/ai/budget.ts) sums
--    this table before every call.
--
--  * voice_violations: tone drift becomes a table. The voice sweep in
--    the chokepoint logs what it caught (source, violation labels,
--    short excerpts) via src/lib/voice/log.ts.
--
--  * audit_events: privileged writes leave a trail. Invites, converts,
--    plan approvals, takedowns and camp lifecycle deletes append a row
--    via src/lib/audit/log.ts. metadata holds field NAMES and primitive
--    labels only, NEVER values or user content.
--
-- ALL THREE TABLES ARE OPERATOR-SCOPED AND SEALED. RLS is enabled with
-- ZERO policies and every direct grant is revoked, so no app role
-- (anon, authenticated) can read or write a single row. The service
-- role, which bypasses RLS, is the ONLY reader and writer. App code
-- reaches them exclusively through the admin chokepoint
-- (src/lib/supabase/admin.ts), fire-and-forget, never user-blocking.
-- Registered in the enumeration ratchet (e2e/isolation-coverage.spec.ts)
-- and documented in SECURITY.md's threat model.

-- ── ai_calls: the cost ledger ────────────────────────────────

create table if not exists ai_calls (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  task text not null,
  model text not null,
  input_tokens int,
  output_tokens int,
  -- Estimated from the static price map in src/lib/ai/cost.ts; null
  -- when the model id has no known price (env-overridden tier).
  cost_usd numeric(10, 6),
  -- Who the call ran on behalf of, when the call site already knows.
  -- Ids only, never names or content.
  actor_id uuid,
  org_id uuid
);

create index if not exists ai_calls_org_created_idx
  on ai_calls (org_id, created_at);

create index if not exists ai_calls_created_idx
  on ai_calls (created_at);

alter table ai_calls enable row level security;

-- Sealed: zero policies, no direct grants. Service role only.
revoke all on table ai_calls from public, anon, authenticated;

-- ── voice_violations: the tone drift log ─────────────────────

create table if not exists voice_violations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  -- Where the text came from, e.g. 'ai.refine'.
  source text not null,
  -- Labels from violatesVoice(), e.g. '{em_dash}'.
  violations text[] not null,
  -- Model output excerpts (capped to 200 chars at the writer). This is
  -- model text, never family input.
  raw_excerpt text,
  cleaned_excerpt text,
  retried boolean not null default false
);

alter table voice_violations enable row level security;

-- Sealed: zero policies, no direct grants. Service role only.
revoke all on table voice_violations from public, anon, authenticated;

-- ── audit_events: the privileged-write trail ─────────────────

create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid,
  -- Short action label, e.g. 'coach.invite', 'media.takedown'.
  action text not null,
  entity_table text not null,
  entity_id text,
  -- Field NAMES and primitive labels only, NEVER values. No user
  -- content, no names, no emails. Keep call sites honest.
  metadata jsonb not null default '{}'::jsonb
);

create index if not exists audit_events_entity_idx
  on audit_events (entity_table, entity_id);

create index if not exists audit_events_created_idx
  on audit_events (created_at);

alter table audit_events enable row level security;

-- Sealed: zero policies, no direct grants. Service role only.
revoke all on table audit_events from public, anon, authenticated;
