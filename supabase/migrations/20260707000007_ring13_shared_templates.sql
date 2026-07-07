-- ============================================================
-- Wild Wanderers — Ring 13.6: templates shared with clients
--
-- A template reaches clients only when Gabe flips it visible, per
-- template, default off. Clients get read-only policies on the
-- visible, active ones; a client picks one to PREFILL their own
-- builder, and what they save is an ordinary self-directed plan in
-- their own lane. No client write policy of any kind lands here.
-- ============================================================

alter table plan_templates
  add column if not exists is_client_visible boolean not null default false;

create policy "clients_read_shared_templates"
  on plan_templates for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'client'
    and is_active
    and is_client_visible
  );

-- Children delegate to the parent: the subqueries run under the
-- client's own RLS, so only shared templates' trees resolve.
create policy "clients_read_shared_template_workouts"
  on template_workouts for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'client'
    and template_id in (select id from plan_templates)
  );

create policy "clients_read_shared_template_workout_exercises"
  on template_workout_exercises for select
  using (
    org_id = get_user_org()
    and get_user_role() = 'client'
    and template_workout_id in (select id from template_workouts)
  );
