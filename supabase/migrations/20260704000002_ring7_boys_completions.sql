-- ============================================================
-- Wild Wanderers — Ring 7: the boys program completions
--
-- Completing the Ring 5 boys program the way a family actually joins one:
-- the family comes first, the forms get signed, a spot is offered and
-- accepted, and each boy's adventure is logged and visible to his family.
-- Mentor onboarding is held for its own ring (Ring 8). See RING7_SPEC.md.
--
-- Guardrails:
--   * Minors' data. Emergency contacts, medical info, and signed forms are
--     the most sensitive data in the app. Org-scoped and staff-only from
--     this first migration, plus parent-own-child via the Ring 5 helper
--     current_user_participant_ids(). No client, no other family, no other
--     org ever reaches it.
--   * A waiver gates a session. Forms are versioned; an acknowledgement
--     records who signed which version and when. A version bump clears the
--     signed state until re-signed.
--   * Tuition reuses Ring 4. An enrollment links to a boys_program offering;
--     enrolling writes one revenue_event through the Ring 4 path. A
--     scholarship is a recorded discount, never a second ledger.
--   * No fabricated families. We seed only the form catalog (placeholder
--     text Gabe replaces before any family signs) and nothing else.
-- ============================================================

-- ── Enums ──────────────────────────────────────────────────
create type guardian_relationship as enum ('parent', 'guardian', 'other');
create type form_kind as enum (
  'waiver', 'medical', 'photo_release', 'pickup', 'code_of_conduct', 'parent_agreement'
);
create type enrollment_status as enum (
  'interested', 'waitlisted', 'offered', 'enrolled', 'withdrawn'
);
create type adventure_entry_kind as enum ('journal', 'check_in', 'mentor_note');

-- ── guardians (the family anchor; owns one or more kids) ───
-- The login link moves here from participants; the Ring 5 parent_* fields
-- stay for back-compat and are backfilled below.
create table guardians (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  user_id uuid references profiles(id),        -- the family login, once invited
  first_name text not null,
  last_name text not null,
  email text,
  phone text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index guardians_org_idx on guardians (org_id);
create index guardians_user_idx on guardians (user_id);

-- ── participant_guardians (many-to-many; carries pickup auth) ─
create table participant_guardians (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  participant_id uuid references participants(id) on delete cascade not null,
  guardian_id uuid references guardians(id) on delete cascade not null,
  relationship guardian_relationship not null default 'parent',
  is_primary boolean not null default false,
  can_pickup boolean not null default true,
  created_at timestamptz not null default now(),
  unique (participant_id, guardian_id)
);
create index participant_guardians_participant_idx on participant_guardians (participant_id);
create index participant_guardians_guardian_idx on participant_guardians (guardian_id);

-- ── participant_medical (one per kid, tightly scoped) ──────
create table participant_medical (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  participant_id uuid references participants(id) on delete cascade not null unique,
  allergies text,
  conditions text,
  medications text,
  notes text,
  doctor_name text,
  doctor_phone text,
  insurance_note text,
  updated_at timestamptz not null default now()
);
create index participant_medical_participant_idx on participant_medical (participant_id);

-- ── emergency_contacts ─────────────────────────────────────
create table emergency_contacts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  participant_id uuid references participants(id) on delete cascade not null,
  name text not null,
  relationship text,
  phone text not null,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index emergency_contacts_participant_idx on emergency_contacts (participant_id);

-- ── forms (catalog; one row per kind, versioned) ───────────
create table forms (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  kind form_kind not null,
  title text not null,
  body text,
  version int not null default 1,
  is_required boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, kind)
);
create index forms_org_idx on forms (org_id);

-- ── form_acknowledgements (who signed which version, when) ──
create table form_acknowledgements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  form_id uuid references forms(id) on delete cascade not null,
  form_version int not null,
  participant_id uuid references participants(id) on delete cascade not null,
  guardian_id uuid references guardians(id) on delete set null,
  acknowledged_by uuid references profiles(id),
  signed_name text,
  acknowledged_at timestamptz not null default now(),
  unique (form_id, form_version, participant_id)
);
create index form_ack_participant_idx on form_acknowledgements (participant_id);
create index form_ack_form_idx on form_acknowledgements (form_id);

-- ── enrollments (interested -> enrolled, tied to Ring 4) ───
create table enrollments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  program_id uuid references programs(id) on delete cascade not null,
  participant_id uuid references participants(id) on delete cascade not null,
  guardian_id uuid references guardians(id) on delete set null,
  status enrollment_status not null default 'interested',
  offering_id uuid references offerings(id) on delete set null,
  tuition_cents int,
  scholarship_cents int not null default 0,
  scholarship_reason text,
  notes text,
  created_at timestamptz not null default now(),
  status_changed_at timestamptz not null default now(),
  unique (program_id, participant_id)
);
create index enrollments_program_idx on enrollments (program_id, status);
create index enrollments_participant_idx on enrollments (participant_id);

-- ── adventure_entries (the boy's story; family read-only) ──
create table adventure_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  participant_id uuid references participants(id) on delete cascade not null,
  kind adventure_entry_kind not null default 'journal',
  title text,
  body text not null,
  entry_date date not null default (now() at time zone 'utc')::date,
  author_id uuid references profiles(id),
  visible_to_family boolean not null default true,
  created_at timestamptz not null default now()
);
create index adventure_entries_participant_idx on adventure_entries (participant_id, entry_date desc);

-- ============================================================
-- ROW LEVEL SECURITY
-- Staff (owner, coach) manage everything in their org. A parent reads and,
-- where the family does the data entry, writes only their own kids'. The
-- Ring 5 helper current_user_participant_ids() drives the parent scope.
-- ============================================================
alter table guardians              enable row level security;
alter table participant_guardians  enable row level security;
alter table participant_medical    enable row level security;
alter table emergency_contacts     enable row level security;
alter table forms                  enable row level security;
alter table form_acknowledgements  enable row level security;
alter table enrollments            enable row level security;
alter table adventure_entries      enable row level security;

-- guardians: staff manage; a parent reads their own guardian record.
create policy "staff_manage_guardians" on guardians for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));
create policy "parent_reads_self_guardian" on guardians for select
  using (get_user_role() = 'parent' and user_id = auth.uid());

-- participant_guardians: staff manage; a parent reads links to their kids.
create policy "staff_manage_participant_guardians" on participant_guardians for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));
create policy "parent_reads_child_guardian_links" on participant_guardians for select
  using (get_user_role() = 'parent' and participant_id = any (current_user_participant_ids()));

-- participant_medical: staff manage; a parent manages their own kid's (the
-- family fills this in on the intake surface).
create policy "staff_manage_participant_medical" on participant_medical for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));
create policy "parent_manages_child_medical" on participant_medical for all
  using (get_user_role() = 'parent' and participant_id = any (current_user_participant_ids()))
  with check (get_user_role() = 'parent' and participant_id = any (current_user_participant_ids()));

-- emergency_contacts: staff manage; a parent manages their own kid's.
create policy "staff_manage_emergency_contacts" on emergency_contacts for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));
create policy "parent_manages_child_emergency" on emergency_contacts for all
  using (get_user_role() = 'parent' and participant_id = any (current_user_participant_ids()))
  with check (get_user_role() = 'parent' and participant_id = any (current_user_participant_ids()));

-- forms (catalog): org members read; staff manage.
create policy "org_reads_forms" on forms for select
  using (org_id = get_user_org());
create policy "staff_manage_forms" on forms for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));

-- form_acknowledgements: staff manage; a parent signs for their own kid.
create policy "staff_manage_form_ack" on form_acknowledgements for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));
create policy "parent_manages_child_form_ack" on form_acknowledgements for all
  using (get_user_role() = 'parent' and participant_id = any (current_user_participant_ids()))
  with check (get_user_role() = 'parent' and participant_id = any (current_user_participant_ids()));

-- enrollments: staff manage; a parent reads their own kid's.
create policy "staff_manage_enrollments" on enrollments for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));
create policy "parent_reads_child_enrollments" on enrollments for select
  using (get_user_role() = 'parent' and participant_id = any (current_user_participant_ids()));

-- adventure_entries: staff manage; a parent reads their own kid's, but only
-- the entries marked visible to the family (private mentor notes never cross).
create policy "staff_manage_adventure_entries" on adventure_entries for all
  using (org_id = get_user_org() and get_user_role() in ('owner', 'coach'))
  with check (org_id = get_user_org() and get_user_role() in ('owner', 'coach'));
create policy "parent_reads_child_adventure" on adventure_entries for select
  using (
    get_user_role() = 'parent'
    and visible_to_family
    and participant_id = any (current_user_participant_ids())
  );

-- ============================================================
-- SEED — the six starter forms as clearly-labeled placeholders. Gabe
-- replaces the body with the reviewed text before any family signs; we
-- never ship invented legal language as final. Idempotent.
-- ============================================================
insert into forms (org_id, kind, title, body, is_required)
select o.id, x.kind::form_kind, x.title, x.body, x.required
from public.organizations o,
  (values
    ('waiver', 'Liability waiver',
     'PLACEHOLDER. Replace with the reviewed liability waiver before any family signs.', true),
    ('medical', 'Medical information and consent',
     'PLACEHOLDER. Replace with the medical consent text before any family signs.', true),
    ('photo_release', 'Photo release',
     'PLACEHOLDER. Replace with the photo release text. Families may opt out.', false),
    ('pickup', 'Pickup authorization',
     'PLACEHOLDER. Replace with the pickup authorization terms.', true),
    ('code_of_conduct', 'Code of conduct',
     'PLACEHOLDER. Replace with the program code of conduct.', true),
    ('parent_agreement', 'Parent agreement',
     'PLACEHOLDER. Replace with the parent agreement text.', true)
  ) as x(kind, title, body, required)
where o.slug = 'wild-wanderers-fitness'
on conflict (org_id, kind) do nothing;

-- ============================================================
-- BACKFILL — fold each Ring 5 participant's denormalized parent contact
-- into a guardian and a participant_guardians link, so the family-first
-- model is populated for any kids already on a roster. Idempotent: only
-- creates a link where none exists yet. (No kids exist today; this is
-- correct for when they do.)
-- ============================================================
do $$
declare
  p record;
  g_id uuid;
begin
  for p in
    select id, org_id, parent_user_id, parent_name, parent_email, parent_phone
    from public.participants
    where (parent_name is not null or parent_email is not null or parent_user_id is not null)
      and not exists (select 1 from public.participant_guardians pg where pg.participant_id = participants.id)
  loop
    insert into public.guardians (org_id, user_id, first_name, last_name, email, phone)
    values (
      p.org_id, p.parent_user_id,
      coalesce(split_part(p.parent_name, ' ', 1), 'Family'),
      coalesce(nullif(substr(p.parent_name from position(' ' in p.parent_name) + 1), ''), ''),
      p.parent_email, p.parent_phone
    )
    returning id into g_id;

    insert into public.participant_guardians (org_id, participant_id, guardian_id, relationship, is_primary, can_pickup)
    values (p.org_id, p.id, g_id, 'parent', true, true);
  end loop;
end $$;
