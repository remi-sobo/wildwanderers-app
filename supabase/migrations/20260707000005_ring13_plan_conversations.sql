-- ============================================================
-- Wild Wanderers — Ring 13.1: plan comments and swaps
--
-- Forks plan_activity_comments and plan_activity_swaps from Team
-- Esface (20260601000011_self_directed_training.sql:74-248),
-- retargeted: activities become workout_exercises, the knowledge base
-- becomes the exercise library, and the athlete's circle becomes the
-- plan's own client. The review that says something: Gabe comments on
-- a plan or one exercise and suggests a swap; the client reads it on
-- Training and accepts or declines.
--
-- Visibility inherits from the plan everywhere (the policy subqueries
-- run under the caller's own training_plans RLS), so the walls built
-- in Rings 10 and 11 carry over for free: a client sees conversation
-- only on their own visible plans, staff on the org's, and a resting
-- coach draft's conversation is as invisible to the client as the
-- draft itself.
--
-- Responding to a swap goes through ONE definer RPC, as the fork's
-- swap-respond route did: acceptance rewrites exactly the one agreed
-- exercise row. No client update policy on plan content is widened.
-- ============================================================

create type swap_status as enum ('pending', 'accepted', 'declined');

-- ── plan_comments ────────────────────────────────────────────
create table plan_comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  plan_id uuid references training_plans(id) on delete cascade not null,
  -- null = a comment on the whole plan, not one exercise
  workout_exercise_id uuid references workout_exercises(id) on delete cascade,
  author_id uuid references profiles(id) not null,
  author_role user_role not null,
  content text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_plan_comments_plan on plan_comments (plan_id, created_at);

-- ── plan_swaps ───────────────────────────────────────────────
create table plan_swaps (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  plan_id uuid references training_plans(id) on delete cascade not null,
  workout_exercise_id uuid references workout_exercises(id) on delete cascade not null,
  suggested_by uuid references profiles(id) not null,
  suggested_library_item_id uuid references exercise_library(id) on delete set null,
  suggested_title text not null,
  suggested_sets int,
  suggested_reps text,
  suggested_load text,
  -- Gabe's note: "try this instead, easier on the knee"
  reason text,
  status swap_status not null default 'pending',
  responded_at timestamptz,
  created_at timestamptz default now()
);
create index idx_plan_swaps_plan on plan_swaps (plan_id, status);

-- ── respond_plan_swap: the one path a swap touches a plan ────
-- The plan's own client accepts or declines. Acceptance rewrites the
-- one exercise row from the suggestion (the library item fills what
-- the suggestion leaves blank). SECURITY DEFINER on purpose: the
-- client has, and keeps, no update policy on coach plan content; this
-- narrow, both-parties-agreed write is the only door.
create or replace function public.respond_plan_swap(p_swap_id uuid, p_accept boolean)
returns void
language plpgsql security definer volatile
set search_path = pg_catalog, public
as $$
declare
  v_swap record;
  v_lib record;
begin
  select s.* into v_swap
  from public.plan_swaps s
  join public.training_plans t on t.id = s.plan_id
  where s.id = p_swap_id
    and s.status = 'pending'
    and t.client_id = any (public.current_user_client_id());
  if v_swap is null then
    raise exception 'Swap not found, already answered, or not yours to answer';
  end if;

  if p_accept then
    if v_swap.suggested_library_item_id is not null then
      select title, kind, media_url, default_sets, default_reps into v_lib
      from public.exercise_library where id = v_swap.suggested_library_item_id;
    end if;

    update public.workout_exercises
       set title           = coalesce(v_lib.title, v_swap.suggested_title),
           kind            = coalesce(v_lib.kind, kind),
           sets            = coalesce(v_swap.suggested_sets, v_lib.default_sets, sets),
           reps            = coalesce(v_swap.suggested_reps, v_lib.default_reps, reps),
           load            = coalesce(v_swap.suggested_load, load),
           media_url       = coalesce(v_lib.media_url, media_url),
           library_item_id = v_swap.suggested_library_item_id
     where id = v_swap.workout_exercise_id;
  end if;

  update public.plan_swaps
     set status = case when p_accept then 'accepted'::swap_status else 'declined'::swap_status end,
         responded_at = now()
   where id = p_swap_id;
end;
$$;
revoke execute on function public.respond_plan_swap(uuid, boolean) from public, anon;
grant  execute on function public.respond_plan_swap(uuid, boolean) to authenticated;

-- ============================================================
-- ROW LEVEL SECURITY — visibility inherited from the plan
-- ============================================================

alter table plan_comments enable row level security;
alter table plan_swaps    enable row level security;

-- Comments: whoever can see the plan can read its conversation.
create policy "circle_read_plan_comments"
  on plan_comments for select
  using (org_id = get_user_org() and plan_id in (select id from training_plans));

-- Staff and the plan's own people write, with the author pinned so
-- nobody speaks as anybody else (fork pattern).
create policy "circle_write_plan_comments"
  on plan_comments for insert
  with check (
    org_id = get_user_org()
    and get_user_role() in ('owner', 'coach', 'client')
    and author_id = (select auth.uid())
    and author_role = get_user_role()
    and plan_id in (select id from training_plans)
  );

create policy "authors_update_own_plan_comments"
  on plan_comments for update
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy "authors_delete_own_plan_comments"
  on plan_comments for delete
  using (author_id = (select auth.uid()));

-- Swaps: read rides the plan; only staff suggest; a staff member can
-- withdraw their own unanswered suggestion. Responding is the RPC.
create policy "circle_read_plan_swaps"
  on plan_swaps for select
  using (org_id = get_user_org() and plan_id in (select id from training_plans));

create policy "staff_create_plan_swaps"
  on plan_swaps for insert
  with check (
    org_id = get_user_org()
    and get_user_role() in ('owner', 'coach')
    and suggested_by = (select auth.uid())
    and plan_id in (select id from training_plans)
  );

create policy "staff_withdraw_own_pending_swaps"
  on plan_swaps for delete
  using (
    org_id = get_user_org()
    and get_user_role() in ('owner', 'coach')
    and suggested_by = (select auth.uid())
    and status = 'pending'
  );
