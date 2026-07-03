# Ring 3 — Coach AI ("Coach") (Wild Wanderers Platform)

The assist layer. "Coach" is Gabe's tool, not the client's. It drafts and adjusts
workouts, structures check-ins, and surfaces patterns from the logged data, all
coach-facing, all human-in-the-loop. Its home is a floating action button that
opens a drawer on the coach side, so Coach is one tap away from anywhere in the
app.

This ring calls an LLM over a client's training and (read-only) wellness data, so
the CLAUDE.md Coach-AI guardrails are load-bearing and lead the design.

## The Coach-AI guardrails (hold hard, these lead)
- **Scope: programming, habits, and summarizing only.** Coach drafts workouts,
  shapes habits, and summarizes. It gives no medical, nutrition, or health advice
  to clients and diagnoses nothing. No medical claims in anything it generates.
- **Coach-facing only.** Coach is a tool for Gabe. It never speaks to a client and
  never appears on the client surfaces. Anything touching body or food data stays
  something Gabe reads to coach with, never an automated adviser.
- **Every workout it drafts, Gabe approves.** Coach writes plans as `draft`,
  reusing the Ring 1 draft-and-approve status. Nothing it drafts goes live until
  Gabe activates it. Same for check-in structuring: Coach proposes, Gabe keeps.
- **Every call is logged and budgeted.** All Claude calls go through one server
  chokepoint (`src/lib/ai/call.ts`) that logs to the sealed `ai_calls` ledger
  with a cost estimate and stops before a monthly budget cap
  (`AI_MONTHLY_BUDGET_USD`). No call bypasses it.
- **Voice is swept.** Coach output runs the voice rules (no em dashes, no
  AI-giveaway words, never frame the client as broken). A trip is logged to
  `voice_violations` and retried once, mirroring the Team Esface sweep.
- **Reads respect RLS.** Coach only ever sees what Gabe can see. It runs as Gabe
  (the caller's session), never with a key that bypasses tenant isolation, except
  the ledger writes, which go through the sealed admin chokepoint.

## Definition of done
- A floating Coach button sits on the coach shell; tapping it opens a drawer.
- In the drawer, Gabe can ask Coach to **draft a workout or plan** for a client;
  Coach returns a structured plan saved as a `draft` that lands in the plan
  builder for Gabe to review, edit, and activate. Nothing auto-activates.
- Gabe can ask Coach to **summarize a client** from their training, habits,
  movement, and wellness data; Coach returns a short, plain, coach-facing read.
- Every Coach call logs to `ai_calls`; going over the monthly cap stops calls with
  a clear message; voice trips log and retry.
- With no `ANTHROPIC_API_KEY` set, Coach shows a friendly "not configured yet"
  state and the rest of the app is unaffected.
- No medical claim, no client-facing AI, no fabricated client value. `npm run
  build` and the type check pass.

## New tables (sealed ledgers, forked from Team Esface)
Forked from `team-esface-migrations/20260702000001_observability_ledger_audit.sql`
(we already took `audit_events` in Ring 2; this ring takes the other two):
- `ai_calls` — id, created_at, task, model, input_tokens, output_tokens,
  cost_usd, actor_id, org_id. One row per Claude call, best-effort, from the
  chokepoint. Month-to-date spend is a query over this.
- `voice_violations` — id, created_at, source, violations text[], raw_excerpt,
  cleaned_excerpt, retried. What the voice sweep caught.
Both sealed: RLS on, zero policies, all grants revoked, service-role only.

No new domain tables. Coach writes into the existing Ring 1/2 tables:
`training_plans`/`workouts`/`workout_exercises` (as `draft`) and `check_ins`
(the `structured` jsonb, still null from Ring 2).

## The AI chokepoint (`src/lib/ai/`)
- `call.ts` — the one door. Checks the budget (`budget.ts` sums `ai_calls` for the
  month against `AI_MONTHLY_BUDGET_USD`), calls Claude with a scoped system
  prompt, runs the voice sweep (`voice/sweep.ts`) and retries once on a trip,
  logs `ai_calls` and any `voice_violations` fire-and-forget through the admin
  chokepoint, and returns the result (text or a validated tool payload).
- `cost.ts` — a static per-model price map for the estimate (null when unknown).
- Structured tasks (workout draft, check-in structure) use tool-use so Coach
  returns validated JSON, not prose we parse.
- Default model: Claude Sonnet 5 for drafting, Haiku 4.5 for light summaries and
  nudges (decision 1). Key from `ANTHROPIC_API_KEY` (decision 2).

## Surfaces
- **Coach FAB + drawer (coach shell only).** A floating amber action button,
  bottom-right, above the content, on every coach page. It opens a right-side
  drawer: a short list of what Coach can do, a client picker, and a prompt. Coach
  streams back its answer. A drafted plan shows a "Review draft" link into the
  plan builder; a summary shows inline. Warm, calm, clearly labeled as a draft
  assistant for Gabe. Never rendered on the client shell.
- **Plan builder** gains a "Draft with Coach" entry that pre-fills the builder
  from Coach's proposal, which Gabe edits and activates (reusing the Ring 1
  create-and-activate path; status stays `draft` until Gabe acts).
- **Check-in structuring** (if in scope this ring, decision 3): a check-in Gabe
  opens shows a "Structure with Coach" action that fills `check_ins.structured`
  for a fast read. Ring 2 already captures the check-ins.

## Voice check-ins (Deepgram)
Deferred to a later pass (decision 4). Ring 2 stored `check_ins.voice_url` and
`kind`; transcription with Deepgram plus structuring is its own commit once the
text Coach is proven. Ring 3 ships the text assist first.

## Commit sequence
1. **Migration + chokepoint** — `ai_calls` and `voice_violations` sealed ledgers,
   the `src/lib/ai/` chokepoint (call, budget, cost, voice sweep), and the
   Anthropic client. Verified: a call logs a row, the budget stops, a voice trip
   retries. No UI yet.
2. **Coach FAB + drawer** — the floating button and drawer on the coach shell,
   wired to a "summarize this client" task end to end.
3. **Draft a workout** — Coach drafts a plan as `draft`; the drawer links into the
   plan builder pre-filled; Gabe edits and activates.
4. **Check-in structuring** (decision 3) and the final pass: extend the demo
   client, confirm no client-facing AI, then merge.

Each commit: build green, one change at a time, every AI call logged and
budgeted, nothing client-facing, no medical claim, shown before it lands.

## Decisions to confirm before build
1. **Model + budget** — Sonnet 5 for drafting, Haiku 4.5 for summaries/nudges, and
   a monthly cap `AI_MONTHLY_BUDGET_USD` (suggest 25). Adjust the tiers or the cap?
2. **`ANTHROPIC_API_KEY`** — do you have a key to set in Vercel? I can build the
   whole chokepoint and drawer so it lights up the moment the key lands (friendly
   "not configured" state until then).
3. **Check-in structuring this ring** — ship it in Ring 3 (recommended, the
   tables are ready), or hold it with voice for a 3b?
4. **Voice check-ins (Deepgram)** — defer to a later pass (recommended), or in now?
5. **FAB scope** — coach shell only, per the guardrail that Coach is Gabe's tool
   and never client-facing. Confirm.
