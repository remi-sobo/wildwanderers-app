-- ============================================================
-- Wild Wanderers — Pop-up roll call, part 2: days, guests, waivers, roll
-- (specs/popup-roll-call.md)
--
--   * popup_days       — one row per Saturday, with a sign_token for the QR
--                        guests scan to sign the waiver on their own phone.
--   * popup_guests     — a person who came (or signed). A parent's email can
--                        carry several kids, so a guest is keyed by email AND
--                        name, not by library_subscribers' one-per-email row.
--   * popup_waivers    — who signed which version, when, and how (on their
--                        phone, or on paper and recorded by the owner). The
--                        form says it is valid for the 2026 season, so a
--                        signature is per guest per version, not per visit.
--   * popup_attendance — the roll: one row per guest per day, who they came
--                        with (bring two friends and your session is free),
--                        and whether the owner comped the session.
--
-- Guardrails:
--   * Owner-only from this migration. Emergency contacts and minors' ages
--     live here; no coach, client, other org, or anon reads a row.
--   * The public signing path is one SECURITY DEFINER function, keyed by a
--     day's unguessable token. It writes; it never returns another person's
--     data. A second read-only function returns only the waiver text.
--   * The waiver text is Gabe's own document, stored verbatim and versioned.
--     A new version re-prompts; an old signature is never carried forward.
--   * library_subscribers is still the email list. A walk-up or a signer joins
--     it only if they said yes. anon's insert narrows to the columns the
--     public forms write.
-- ============================================================

-- ── library_subscribers: keep the name and phone the forms collect ──
alter table library_subscribers
  add column if not exists name text,
  add column if not exists phone text,
  add column if not exists added_by uuid references profiles(id);

-- anon's table-wide insert becomes column-scoped: the marketing forms may set
-- the org, email, source, name, and phone, never added_by.
revoke insert on library_subscribers from anon;
grant insert (org_id, email, source, name, phone) on library_subscribers to anon;

-- ── forms: a season end for documents that say how long they hold ──
alter table forms add column if not exists valid_through date;

-- ── popup_days ─────────────────────────────────────────────
create table popup_days (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location text,
  notes text,
  sign_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index popup_days_org_idx on popup_days (org_id, starts_at desc);

-- ── popup_guests ───────────────────────────────────────────
create table popup_guests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  full_name text not null,
  email text not null,
  phone text,
  age_if_minor int check (age_if_minor between 10 and 17),
  subscriber_id uuid references library_subscribers(id) on delete set null,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index popup_guests_org_email_name_idx
  on popup_guests (org_id, lower(email), lower(full_name));
create unique index popup_guests_subscriber_idx
  on popup_guests (subscriber_id) where subscriber_id is not null;

-- ── popup_waivers ──────────────────────────────────────────
create table popup_waivers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  guest_id uuid references popup_guests(id) on delete cascade not null,
  form_id uuid references forms(id) not null,
  form_version int not null,
  valid_through date,
  signed_via text not null check (signed_via in ('self', 'paper')),
  signed_name text,
  guardian_name text,
  guardian_relationship text,
  emergency_name text,
  emergency_phone text,
  photo_ok boolean,
  signed_ip text,
  user_agent text,
  recorded_by uuid references profiles(id),
  signed_at timestamptz not null default now(),
  unique (guest_id, form_id, form_version)
);
create index popup_waivers_guest_idx on popup_waivers (guest_id);

-- ── popup_attendance ───────────────────────────────────────
create table popup_attendance (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  popup_day_id uuid references popup_days(id) on delete cascade not null,
  guest_id uuid references popup_guests(id) on delete cascade not null,
  brought_by uuid references popup_guests(id) on delete set null,
  free_session boolean not null default false,
  marked_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (popup_day_id, guest_id),
  check (brought_by is null or brought_by <> guest_id)
);
create index popup_attendance_day_idx on popup_attendance (popup_day_id);

-- ── Same-org guards ────────────────────────────────────────
-- Every reference must stay inside the row's org, so a forged id can never
-- tie one org's guest to another org's day, form, or subscriber.
create or replace function public.popup_same_org_guard()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public
as $$
begin
  if tg_table_name = 'popup_guests' then
    if new.subscriber_id is not null and not exists (
      select 1 from library_subscribers s where s.id = new.subscriber_id and s.org_id = new.org_id
    ) then raise exception 'cross-org reference' using errcode = '42501'; end if;
    new.updated_at := now();
  elsif tg_table_name = 'popup_waivers' then
    if not exists (select 1 from popup_guests g where g.id = new.guest_id and g.org_id = new.org_id)
      or not exists (select 1 from forms f where f.id = new.form_id and f.org_id = new.org_id)
    then raise exception 'cross-org reference' using errcode = '42501'; end if;
  elsif tg_table_name = 'popup_attendance' then
    if not exists (select 1 from popup_days d where d.id = new.popup_day_id and d.org_id = new.org_id)
      or not exists (select 1 from popup_guests g where g.id = new.guest_id and g.org_id = new.org_id)
      or (new.brought_by is not null and not exists (
        select 1 from popup_guests g where g.id = new.brought_by and g.org_id = new.org_id))
    then raise exception 'cross-org reference' using errcode = '42501'; end if;
    new.updated_at := now();
  end if;
  return new;
end;
$$;
revoke execute on function public.popup_same_org_guard() from public, anon, authenticated;

create trigger popup_guests_guard before insert or update on popup_guests
  for each row execute function public.popup_same_org_guard();
create trigger popup_waivers_guard before insert or update on popup_waivers
  for each row execute function public.popup_same_org_guard();
create trigger popup_attendance_guard before insert or update on popup_attendance
  for each row execute function public.popup_same_org_guard();

-- ============================================================
-- ROW LEVEL SECURITY — owner only
-- ============================================================
alter table popup_days       enable row level security;
alter table popup_guests     enable row level security;
alter table popup_waivers    enable row level security;
alter table popup_attendance enable row level security;

create policy "owner_manages_popup_days" on popup_days for all to authenticated
  using (org_id = get_user_org() and get_user_role() = 'owner')
  with check (org_id = get_user_org() and get_user_role() = 'owner');
create policy "owner_manages_popup_guests" on popup_guests for all to authenticated
  using (org_id = get_user_org() and get_user_role() = 'owner')
  with check (org_id = get_user_org() and get_user_role() = 'owner');
create policy "owner_manages_popup_waivers" on popup_waivers for all to authenticated
  using (org_id = get_user_org() and get_user_role() = 'owner')
  with check (org_id = get_user_org() and get_user_role() = 'owner');
create policy "owner_manages_popup_attendance" on popup_attendance for all to authenticated
  using (org_id = get_user_org() and get_user_role() = 'owner')
  with check (org_id = get_user_org() and get_user_role() = 'owner');

-- anon reaches these tables only through the functions below.
revoke all on popup_days, popup_guests, popup_waivers, popup_attendance from anon;

-- ============================================================
-- PUBLIC SIGNING (the QR at the table)
-- ============================================================

-- The window in which a signature also marks the guest here: from two hours
-- before the start to two hours after the end (or three hours after the start
-- when no end is set). Outside it, signing ahead still records the waiver.
create or replace function public.popup_day_is_open(d popup_days)
returns boolean
language sql stable
set search_path = pg_catalog, public
as $$
  select now() between d.starts_at - interval '2 hours'
                   and coalesce(d.ends_at, d.starts_at + interval '3 hours') + interval '2 hours';
$$;
revoke execute on function public.popup_day_is_open(popup_days) from public, anon, authenticated;

-- What the signing page shows: the day's start and the current waiver text.
-- Never the location (shared by email only), never anyone's data. Returns no
-- row for an unknown token, a past day, or an org with no active waiver.
create or replace function public.popup_waiver_for_token(p_token text)
returns table (starts_at timestamptz, title text, body text, version int, valid_through date)
language sql stable security definer
set search_path = pg_catalog, public
as $$
  select d.starts_at, f.title, f.body, f.version, f.valid_through
  from popup_days d
  join forms f on f.org_id = d.org_id and f.kind = 'popup_waiver' and f.is_active
  where d.sign_token = p_token
    and coalesce(d.ends_at, d.starts_at + interval '3 hours') + interval '12 hours' > now()
    and (f.valid_through is null or f.valid_through >= current_date);
$$;
revoke execute on function public.popup_waiver_for_token(text) from public;
grant execute on function public.popup_waiver_for_token(text) to anon, authenticated;

-- Sign the waiver from a guest's own phone. Validates everything itself, since
-- anon calls it: the token resolves the org, the form is the org's active
-- version, ages 10 to 17 need a parent or guardian, under 10 is refused.
-- Joins the email list only on opt-in. Marks the guest here when the day is
-- open. Returns only ok, an error code, and whether they were marked here.
create or replace function public.sign_popup_waiver(
  p_token text,
  p_full_name text,
  p_email text,
  p_phone text,
  p_age_if_minor int,
  p_emergency_name text,
  p_emergency_phone text,
  p_photo_ok boolean,
  p_signed_name text,
  p_guardian_name text,
  p_guardian_relationship text,
  p_email_opt_in boolean,
  p_ip text,
  p_user_agent text
)
returns jsonb
language plpgsql volatile security definer
set search_path = pg_catalog, public
as $$
declare
  v_day popup_days;
  v_form forms;
  v_name text := btrim(coalesce(p_full_name, ''));
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_sub_id uuid;
  v_guest_id uuid;
  v_here boolean := false;
begin
  select * into v_day from popup_days
  where sign_token = p_token
    and coalesce(ends_at, starts_at + interval '3 hours') + interval '12 hours' > now();
  if v_day.id is null then return jsonb_build_object('ok', false, 'error', 'link_expired'); end if;

  select * into v_form from forms
  where org_id = v_day.org_id and kind = 'popup_waiver' and is_active
    and (valid_through is null or valid_through >= current_date);
  if v_form.id is null then return jsonb_build_object('ok', false, 'error', 'no_waiver'); end if;

  if v_name = '' or length(v_name) > 120
    or v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' or length(v_email) > 254
    or length(coalesce(p_phone, '')) > 40
    or btrim(coalesce(p_emergency_name, '')) = '' or length(p_emergency_name) > 120
    or btrim(coalesce(p_emergency_phone, '')) = '' or length(p_emergency_phone) > 40
    or p_photo_ok is null
    or btrim(coalesce(p_signed_name, '')) = '' or length(p_signed_name) > 120
  then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;

  if p_age_if_minor is not null then
    if p_age_if_minor < 10 then return jsonb_build_object('ok', false, 'error', 'too_young'); end if;
    if p_age_if_minor > 17 then return jsonb_build_object('ok', false, 'error', 'invalid'); end if;
    if btrim(coalesce(p_guardian_name, '')) = '' or length(p_guardian_name) > 120
      or btrim(coalesce(p_guardian_relationship, '')) = '' or length(p_guardian_relationship) > 60
    then return jsonb_build_object('ok', false, 'error', 'guardian_required'); end if;
  end if;

  -- The email list, only on a yes. A minor's email is the parent's, so the
  -- list row carries the parent's name.
  if coalesce(p_email_opt_in, false) then
    insert into library_subscribers (org_id, email, source, name, phone)
    values (v_day.org_id, v_email, 'saturday',
            case when p_age_if_minor is null then v_name else btrim(p_guardian_name) end,
            nullif(btrim(coalesce(p_phone, '')), ''))
    on conflict (org_id, (lower(email))) do nothing;
  end if;
  -- An adult links to their own list row (if any) so the roster shows one
  -- line for them. A minor never links: the row is the parent's.
  if p_age_if_minor is null then
    select id into v_sub_id from library_subscribers
    where org_id = v_day.org_id and lower(email) = v_email
      and not exists (select 1 from popup_guests g where g.subscriber_id = library_subscribers.id
                      and not (lower(g.email) = v_email and lower(g.full_name) = lower(v_name)));
  end if;

  insert into popup_guests (org_id, full_name, email, phone, age_if_minor, subscriber_id)
  values (v_day.org_id, v_name, v_email, nullif(btrim(coalesce(p_phone, '')), ''), p_age_if_minor, v_sub_id)
  on conflict (org_id, (lower(email)), (lower(full_name))) do update
    set phone = coalesce(excluded.phone, popup_guests.phone),
        age_if_minor = excluded.age_if_minor,
        subscriber_id = coalesce(popup_guests.subscriber_id, excluded.subscriber_id)
  returning id into v_guest_id;

  insert into popup_waivers (
    org_id, guest_id, form_id, form_version, valid_through, signed_via, signed_name,
    guardian_name, guardian_relationship, emergency_name, emergency_phone, photo_ok,
    signed_ip, user_agent
  ) values (
    v_day.org_id, v_guest_id, v_form.id, v_form.version, v_form.valid_through, 'self',
    btrim(p_signed_name),
    case when p_age_if_minor is null then null else btrim(p_guardian_name) end,
    case when p_age_if_minor is null then null else btrim(p_guardian_relationship) end,
    btrim(p_emergency_name), btrim(p_emergency_phone), p_photo_ok,
    left(p_ip, 64), left(p_user_agent, 300)
  )
  on conflict (guest_id, form_id, form_version) do nothing;

  if public.popup_day_is_open(v_day) then
    insert into popup_attendance (org_id, popup_day_id, guest_id)
    values (v_day.org_id, v_day.id, v_guest_id)
    on conflict (popup_day_id, guest_id) do nothing;
    v_here := true;
  end if;

  return jsonb_build_object('ok', true, 'here', v_here);
end;
$$;
revoke execute on function public.sign_popup_waiver(
  text, text, text, text, int, text, text, boolean, text, text, text, boolean, text, text
) from public;
grant execute on function public.sign_popup_waiver(
  text, text, text, text, int, text, text, boolean, text, text, text, boolean, text, text
) to anon, authenticated;

-- ============================================================
-- SEED — the waiver and the four published Saturdays
-- Wild Wanderers Fitness only: the text is Gabe's document (uploaded
-- 2026-10-19), stored verbatim, valid for the 2026 season as it says. The
-- dates and times are the ones on the live Saturday page. Location stays
-- empty: it is shared by email, and Gabe fills it in.
-- ============================================================
insert into forms (org_id, kind, title, body, version, is_required, valid_through)
select o.id, 'popup_waiver',
  'Participation Agreement and Release of Liability — Saturday Pop-Up Workouts',
  $waiver$1. What this is. I am choosing to take part in outdoor group fitness sessions led by Gabe Brewer of Wild Wanderers Fitness, held at parks and outdoor locations on the Peninsula.

2. I understand the risks. Exercise is physical work, and working out outdoors adds things a gym doesn't have: uneven ground, weather, sun, and shared public space. I understand that participation carries risk of injury, and I accept those risks voluntarily.

3. My health is my call. I confirm that the participant is physically able to participate, and that any condition that could be affected by exercise has been cleared with a doctor. I will tell the coach about injuries or limitations before we start, and the participant will scale or sit out any exercise that doesn't feel right. Nothing in these sessions is medical advice.

4. Release. To the fullest extent permitted by California law, I release Gabe Brewer and Wild Wanderers Fitness from liability for injuries or losses arising from ordinary negligence in connection with these sessions. I understand this release does not cover gross negligence or willful misconduct, which California law does not allow a waiver to cover.

5. If the participant is hurt. I authorize the coach to arrange first aid or emergency medical care if needed, and I am responsible for any medical costs.

6. Participants under 18. Participants age 10 and up are welcome. A participant under 18 may take part only when this form is signed by their parent or legal guardian, and a parent or guardian must be present at the session. By signing below, I certify that I am the participant's parent or legal guardian, I have the authority to sign on their behalf, and I agree to every section of this form for the participant and for myself.

7. Photos (optional, your choice). Wild Wanderers sometimes takes photos at sessions for its website and social media.

One form per participant. Valid for all Wild Wanderers Fitness pop-up sessions in 2026.$waiver$,
  1, true, date '2026-12-31'
from organizations o
where o.slug = 'wild-wanderers-fitness'
on conflict (org_id, kind) do nothing;

insert into popup_days (org_id, starts_at, ends_at)
select o.id,
  (d::timestamp + time '08:00') at time zone 'America/Los_Angeles',
  (d::timestamp + time '09:30') at time zone 'America/Los_Angeles'
from organizations o,
  (values (date '2026-10-24'), (date '2026-11-07'), (date '2026-11-21'), (date '2026-12-05')) as v(d)
where o.slug = 'wild-wanderers-fitness'
  and not exists (select 1 from popup_days p where p.org_id = o.id);
