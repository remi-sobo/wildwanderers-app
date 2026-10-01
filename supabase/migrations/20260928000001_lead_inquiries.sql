-- ============================================================
-- Wild Wanderers — Speed to lead, part 1: lead_inquiries
--
-- The staging table for the free-session form on wildwanderers.life. A
-- visitor's inquiry lands here, never straight on the pipeline, so spam
-- cannot pollute the board. Gabe accepts an inquiry into a real lead (source
-- website, stage new) or dismisses it without residue. The leads table and
-- its stages are untouched.
--
-- Anon reach mirrors library_subscribers (Ring 8) exactly:
--   * anon may INSERT one narrow shape, bound to an org that has a published
--     public library (a subselect anon is itself allowed to read). The same
--     org the marketing site already resolves server-side for the subscribe
--     route.
--   * Column-level grants: anon can write only org_id, name, email, phone,
--     interest, message, preferred_times. status, accepted_lead_id, id and
--     created_at always take their defaults on a public insert.
--   * No SELECT, UPDATE, or DELETE for anon, ever. A submitter cannot read
--     their own row back.
--   * No new anon-callable SECURITY DEFINER function. The dedupe trigger
--     below is definer, but a trigger function cannot be called over the API,
--     and execute is revoked from everyone regardless.
--
-- Staff reach is owner-only, the same as leads and lead_activities (Ring 4).
-- Accepting an inquiry creates a lead, which only the owner may do, and the
-- message is private (below), so a coach gets no read here either. No client
-- role access of any kind.
--
-- PRIVACY: `message` may carry health context a stranger volunteers
-- ("recovering from surgery"). It is treated like a client's own words:
-- owner-only, never in analytics, never in a log line, never on the
-- marketing side, never shown to any client role.
--
-- Idempotency: a repeat submit of the same contact to the same org within
-- ten minutes, while the first is still new, is refused with 23505
-- (unique_violation). The marketing route treats 23505 as success, the same
-- way the subscribe route treats its duplicate email.
-- ============================================================

create type lead_inquiry_status as enum ('new', 'accepted', 'dismissed');

create table lead_inquiries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organizations(id) not null,
  name text not null,
  email text,
  phone text,
  interest lead_interest not null default 'one_on_one',
  message text,
  preferred_times text[],
  status lead_inquiry_status not null default 'new',
  accepted_lead_id uuid references leads(id) on delete set null,
  created_at timestamptz not null default now(),

  -- At least one way to reach them.
  constraint lead_inquiries_contact_required check (
    coalesce(btrim(email), '') <> '' or coalesce(btrim(phone), '') <> ''
  ),
  -- Public input, so every field is bounded at the database, not only in the
  -- route.
  constraint lead_inquiries_name_len check (char_length(btrim(name)) between 1 and 120),
  constraint lead_inquiries_email_len check (email is null or char_length(email) <= 254),
  constraint lead_inquiries_phone_len check (phone is null or char_length(phone) <= 40),
  constraint lead_inquiries_message_len check (message is null or char_length(message) <= 1000),
  constraint lead_inquiries_times_len check (
    preferred_times is null or cardinality(preferred_times) <= 6
  )
);

-- The inbox strip reads new inquiries per org, newest first.
create index lead_inquiries_org_status_idx on lead_inquiries (org_id, status, created_at desc);
create index lead_inquiries_accepted_lead_idx on lead_inquiries (accepted_lead_id)
  where accepted_lead_id is not null;

-- ── Dedupe: a double-tap or a resubmit is not a second inquiry ─────────
create or replace function lead_inquiries_dedupe()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if exists (
    select 1 from public.lead_inquiries i
    where i.org_id = new.org_id
      and i.status = 'new'
      and i.created_at > now() - interval '10 minutes'
      and (
        (new.email is not null and btrim(new.email) <> ''
          and lower(btrim(i.email)) = lower(btrim(new.email)))
        or (new.phone is not null and btrim(new.phone) <> ''
          and regexp_replace(i.phone, '\D', '', 'g') = regexp_replace(new.phone, '\D', '', 'g'))
      )
  ) then
    raise exception 'duplicate inquiry' using errcode = '23505';
  end if;
  return new;
end;
$$;

revoke all on function lead_inquiries_dedupe() from public, anon, authenticated;

create trigger lead_inquiries_dedupe
  before insert on lead_inquiries
  for each row execute function lead_inquiries_dedupe();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table lead_inquiries enable row level security;

-- Anon (the public form) may INSERT one new inquiry, bound to an org that
-- already has a published public library. Status must be new and unlinked;
-- the column grants below make that the only possible shape anyway.
create policy "anon_submits_inquiry"
  on lead_inquiries for insert
  to anon
  with check (
    status = 'new'
    and accepted_lead_id is null
    and exists (
      select 1 from posts p
      where p.org_id = lead_inquiries.org_id
        and p.status = 'published'
        and p.audience = 'public'
    )
  );

-- The owner reads and manages the org's inquiries: accept, dismiss.
create policy "owner_manages_inquiries"
  on lead_inquiries for all
  to authenticated
  using (org_id = get_user_org() and get_user_role() = 'owner')
  with check (org_id = get_user_org() and get_user_role() = 'owner');

-- ── Table grants ───────────────────────────────────────────
-- RLS is the boundary; grants open the door the policies then guard. anon
-- gets column-scoped INSERT only, never SELECT, UPDATE, or DELETE.
revoke all on lead_inquiries from anon;
grant insert (org_id, name, email, phone, interest, message, preferred_times)
  on lead_inquiries to anon;
