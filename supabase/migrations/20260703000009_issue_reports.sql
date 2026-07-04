-- ============================================================
-- Wild Wanderers — issue_reports ("Report an issue")
--
-- A staff member (Gabe now, other coaches later) opens the reporter from
-- the Coach FAB, says what broke / what is confusing / what they want, and
-- Coach runs a short guided interview that synthesizes a precise engineering
-- brief. The result is filed here and emailed to the build team
-- (src/lib/report/email.ts). This is the app-support intake, forked in
-- process from the Trellis "Report an issue" feature and retargeted to Wild
-- Wanderers.
--
-- Org-scoped like every row in this schema: org_id is carried on the row and
-- resolved server-side from the authed user, never trusted from the client.
-- RLS uses the Ring 0 SECURITY DEFINER helpers (get_user_org, get_user_role),
-- flat checks only, so no policy can recurse. No org ever sees another org's
-- reports.
--
-- Screenshots live in the PRIVATE issue-report-screenshots bucket, uploaded
-- and read entirely server-side via the service-role client, org-prefixed
-- object paths (<org_id>/<report_id>/<uuid>.<ext>). Same posture as the
-- checkin-audio bucket, but server-only, so no object policies are needed.
-- ============================================================

create table issue_reports (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organizations(id) not null,
  reported_by     uuid references profiles(id) on delete set null,
  reporter_name   text,
  -- 'bug' | 'confusing' | 'idea'
  kind            text not null default 'bug'
                    check (kind in ('bug', 'confusing', 'idea')),
  title           text not null,
  -- The synthesized engineering brief when the interview produced one,
  -- otherwise the reporter's plain description.
  description     text not null,
  -- The full Coach <-> reporter interview, for provenance.
  transcript      jsonb not null default '[]'::jsonb,
  -- Where the reporter opened the sheet from (route + title).
  page_path       text,
  -- Private storage object path for the attached screenshot, if any.
  screenshot_path text,
  -- 'low' | 'normal' | 'high' | 'critical' — high for bugs by default.
  severity        text not null default 'normal'
                    check (severity in ('low', 'normal', 'high', 'critical')),
  -- 'open' | 'triaged' | 'in_progress' | 'resolved' | 'closed'
  status          text not null default 'open'
                    check (status in ('open', 'triaged', 'in_progress', 'resolved', 'closed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Org + status + recency is the natural triage query.
create index idx_issue_reports_org_status
  on issue_reports (org_id, status, created_at desc);

alter table issue_reports enable row level security;

-- Any signed-in member may file a report for their own org, as themselves.
-- Future-proofs client-side reporting even though the FAB entry is staff-only
-- today; the org + reporter identity are still checked here.
create policy "members_file_issue_reports"
  on issue_reports for insert
  with check (org_id = get_user_org() and reported_by = auth.uid());

-- Staff (owner and coach) read and triage every report in their org.
create policy "staff_read_issue_reports"
  on issue_reports for select
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

create policy "staff_update_issue_reports"
  on issue_reports for update
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

-- A reporter can always read their own reports back.
create policy "reporters_read_own_issue_reports"
  on issue_reports for select
  using (org_id = get_user_org() and reported_by = auth.uid());

-- keep updated_at fresh on triage edits.
create or replace function public.issue_reports_touch_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists issue_reports_touch on issue_reports;
create trigger issue_reports_touch
  before update on issue_reports
  for each row execute function public.issue_reports_touch_updated_at();

-- ── Screenshot bucket ───────────────────────────────────────
-- PRIVATE. Uploaded and read entirely server-side via the service-role
-- client, so it needs no object policies (the service role bypasses RLS).
insert into storage.buckets (id, name, public)
values ('issue-report-screenshots', 'issue-report-screenshots', false)
on conflict (id) do nothing;
