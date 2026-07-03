-- ============================================================
-- LOCK THE DOORS (5/5) — RLS initplan rewrite + hot FK indexes
-- ============================================================
-- The live advisors reported 74 `auth_rls_initplan` warnings: bare
-- `auth.uid()` in a policy is re-evaluated for every row, while
-- `(select auth.uid())` is evaluated once per query (an InitPlan).
-- On large tables that's a 10–100x multiplier, compounding with the
-- overlapping-policy count.
--
-- Rather than hand-rewriting dozens of policies (and drifting from
-- whatever is live), this walks pg_policies and rewrites every
-- policy whose expression still contains a bare `auth.uid()`. It is
-- idempotent: already-wrapped occurrences deparse as
-- `( SELECT auth.uid() AS uid)` and are shielded before the rewrite.

do $$
declare
  pol        record;
  v_qual     text;
  v_check    text;
  v_actions  text;
begin
  for pol in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname in ('public', 'storage')
      and (
        coalesce(qual, '')       ~ 'auth\.uid\(\)'
        or coalesce(with_check, '') ~ 'auth\.uid\(\)'
      )
  loop
    v_qual := pol.qual;
    if v_qual is not null then
      v_qual := replace(v_qual, '( SELECT auth.uid() AS uid)', '@@WRAPPED@@');
      v_qual := replace(v_qual, 'auth.uid()', '(select auth.uid())');
      v_qual := replace(v_qual, '@@WRAPPED@@', '( SELECT auth.uid() AS uid)');
    end if;

    v_check := pol.with_check;
    if v_check is not null then
      v_check := replace(v_check, '( SELECT auth.uid() AS uid)', '@@WRAPPED@@');
      v_check := replace(v_check, 'auth.uid()', '(select auth.uid())');
      v_check := replace(v_check, '@@WRAPPED@@', '( SELECT auth.uid() AS uid)');
    end if;

    -- Nothing actually changed (everything was already wrapped).
    if v_qual is not distinct from pol.qual
       and v_check is not distinct from pol.with_check then
      continue;
    end if;

    v_actions := '';
    if v_qual is not null and v_qual is distinct from pol.qual then
      v_actions := v_actions || format(' using (%s)', v_qual);
    end if;
    if v_check is not null and v_check is distinct from pol.with_check then
      v_actions := v_actions || format(' with check (%s)', v_check);
    end if;

    begin
      execute format(
        'alter policy %I on %I.%I%s',
        pol.policyname, pol.schemaname, pol.tablename, v_actions
      );
    exception
      when insufficient_privilege then
        -- storage.objects ownership can vary by project; skip rather
        -- than fail the whole migration.
        raise notice 'skipped policy % on %.% (insufficient privilege)',
          pol.policyname, pol.schemaname, pol.tablename;
    end;
  end loop;
end;
$$;

-- ── Hot foreign-key indexes ───────────────────────────────────
-- The initial schema shipped almost no secondary indexes. These cover
-- the FK columns on the highest-traffic query paths (leaderboard,
-- profile pages, plan rendering, roster lookups). Columns already
-- covered by a unique constraint's leading column (plan_days.plan_id,
-- activity_completions.plan_activity_id, season_summaries.athlete_id)
-- are intentionally absent.

-- athletes — joined from everywhere
create index if not exists athletes_org_id_idx           on athletes (org_id);
create index if not exists athletes_current_team_id_idx  on athletes (current_team_id);
create index if not exists athletes_user_id_idx          on athletes (user_id);
create index if not exists athletes_current_plan_id_idx  on athletes (current_plan_id);

-- evaluations — profile page + plan attribution ordering
create index if not exists evaluations_athlete_id_idx    on evaluations (athlete_id, completed_at desc);
create index if not exists evaluations_coach_id_idx      on evaluations (coach_id);
create index if not exists evaluations_org_id_idx        on evaluations (org_id);
create index if not exists evaluations_team_id_idx       on evaluations (team_id);

-- activity_completions — the leaderboard + streaks scan this hard
create index if not exists activity_completions_athlete_id_idx
  on activity_completions (athlete_id, completed_at desc);

-- plan structure
create index if not exists plan_activities_plan_day_id_idx
  on plan_activities (plan_day_id, sort_order);
create index if not exists plan_activities_kb_item_id_idx
  on plan_activities (knowledge_base_item_id);

-- transformation_plans
create index if not exists transformation_plans_org_id_idx        on transformation_plans (org_id);
create index if not exists transformation_plans_evaluation_id_idx on transformation_plans (evaluation_id);
create index if not exists transformation_plans_coach_id_idx      on transformation_plans (coach_id);

-- review_sessions
create index if not exists review_sessions_athlete_id_idx    on review_sessions (athlete_id);
create index if not exists review_sessions_coach_id_idx      on review_sessions (coach_id);
create index if not exists review_sessions_evaluation_id_idx on review_sessions (evaluation_id);

-- relationship tables — every RLS helper resolves through these
create index if not exists parent_athletes_parent_id_idx  on parent_athletes (parent_id);
create index if not exists parent_athletes_athlete_id_idx on parent_athletes (athlete_id);
create index if not exists coach_teams_coach_id_idx       on coach_teams (coach_id);
create index if not exists coach_teams_team_id_idx        on coach_teams (team_id);
create index if not exists athlete_teams_athlete_id_idx   on athlete_teams (athlete_id);
create index if not exists athlete_teams_team_id_idx      on athlete_teams (team_id);

-- org-scoped surfaces
create index if not exists teams_org_id_idx           on teams (org_id);
create index if not exists profiles_org_id_idx        on profiles (org_id);
create index if not exists schedule_events_org_id_idx on schedule_events (org_id);
create index if not exists schedule_events_team_id_idx on schedule_events (team_id);
create index if not exists feed_posts_org_id_idx      on feed_posts (org_id, created_at desc);
create index if not exists knowledge_base_items_org_id_idx on knowledge_base_items (org_id);
create index if not exists season_summaries_org_id_idx on season_summaries (org_id);

-- game_moments
create index if not exists game_moments_athlete_id_idx  on game_moments (athlete_id);
create index if not exists game_moments_uploaded_by_idx on game_moments (uploaded_by);
create index if not exists game_moments_team_id_idx     on game_moments (team_id);
create index if not exists game_moments_event_id_idx    on game_moments (event_id);

-- milestones
create index if not exists athlete_milestones_athlete_id_idx
  on athlete_milestones (athlete_id);
create index if not exists athlete_milestones_definition_id_idx
  on athlete_milestones (milestone_definition_id);
