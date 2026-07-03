# SECURITY.md — Wild Wanderers Platform

This app holds client health information behind a login, and one coach reads it to
coach. That makes security the first feature, not a later pass. This is the
operational posture. Hold it from the first migration.

## The boundary: RLS is the security model
Row-level security is the boundary, not the UI. The UI hiding a row is not
security. The database refusing to return it is.

- Every table has RLS enabled. No exceptions, from the migration that creates it.
- Isolation is by `org_id` and by role, enforced through the SECURITY DEFINER
  helpers `get_user_org()` and `get_user_role()`. These are `stable`, pin
  `search_path = pg_catalog, public`, and grant execute to `authenticated` only,
  never `anon`. Do not weaken any of those three properties. They exist because
  the Supabase advisor flagged a search-path shadowing risk and an anon-callable
  definer function, and both were closed on purpose.
- No org ever sees another org. No client ever sees another client. A client sees
  only their own record and their own data. Prove this with a cross-org and
  cross-client read test, do not assume it.
- Avoid policy recursion. When a policy would cross-read another RLS table, use a
  SECURITY DEFINER helper, the pattern the recursion-helpers migration documents.
  A recursive policy takes down every query on the table.

## Keys and secrets
- The service-role key is server-only. It never reaches the browser, never sits in
  a client component, never in `NEXT_PUBLIC_` anything. It bypasses RLS, so it is
  used only in trusted server code and edge functions, and only after an explicit
  ownership check in that code.
- The anon key is public by design. It is safe only because RLS stands behind it.
  That is exactly why the point above about RLS is non-negotiable.
- Secrets live in the environment, never in the repo. `.env*.local` is gitignored.
  Production secrets live in Vercel's env settings and Supabase secrets, not in a
  committed file. If a key is ever committed or pasted anywhere public, rotate it,
  do not just delete the commit.

## Health and body data
Clients log weight, measurements, food, and habits, and Gabe coaches off it. Gabe
is a certified trainer, not a clinician.
- This data is sensitive. Access to it is audited through the ledger, the same
  pattern Team Esface uses for its observability audit.
- Consent at onboarding covers what is tracked and how it is used. A client can
  see their own data and understands who else can.
- No medical claims anywhere in the product. The wellness score is a motivational
  progress signal, never a diagnosis, and it carries a plain note saying so.
- Never put body or food data, or any personal identifier, in a URL, a log line,
  an analytics event, or an error message. Keep it in the database, behind RLS.

## Auth
- Supabase auth. The middleware gates every authenticated route and sends a user
  to their surface by role. An unauthenticated user reaches only login and the
  public auth routes.
- Never trust the client for authorization. Every server action and every query
  re-checks the caller with the role guards, `require-owner`, `require-coach`,
  `require-client`. A hidden button is not a permission.
- Storage buckets are scoped and access is checked server-side, not by obscurity
  of the URL.

## The AI layer, "Coach"
- Coach runs in trusted server or edge-function code and either acts as the signed-
  in user or uses the service role only after an explicit ownership check. It never
  becomes a way around RLS.
- Every AI call is logged to the `ai_calls` ledger: who, when, what for.
- Coach drafts, a human approves. No workout it writes goes live to a client
  without Gabe's approval. Coach gives no medical or nutrition advice to clients.

## Operational hygiene
- The audit ledger records access to sensitive tables. Rate limits protect the
  auth and AI surfaces, the pattern already in the Team Esface migrations.
- Keep dependencies current. Do not add a package to touch health data without a
  reason.
- Least privilege everywhere. A role gets the narrowest access that lets it work.

## The per-ring security check (run before merging any ring)
- RLS is on for every new table, with org and role policies, and the cross-org and
  cross-client read tests pass.
- No service-role key, and no health or personal data, is in the client bundle,
  in a URL, or in a log.
- New server actions and queries re-check the caller with a role guard.
- Any new sensitive table is covered by the audit ledger.
- No medical claim and no fabricated client, stat, or result shipped.

If any of these fails, the ring is not done.
