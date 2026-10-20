"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";

// The roll call's write path. Every action re-checks the owner (a hidden
// button is not a permission); owner RLS and the same-org trigger behind it
// are the real boundary.

export type PopupResult = { error: string | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A case-insensitive exact match for ilike: escape its wildcards so an email
// like a_b@x.com never matches acb@x.com.
function exact(v: string): string {
  return v.replace(/[\\%_]/g, (c) => `\\${c}`);
}

async function ownerContext() {
  const session = await getSessionProfile();
  if (!session?.profile || session.profile.role !== "owner" || !session.profile.org_id) return null;
  return { userId: session.userId, orgId: session.profile.org_id };
}

function refresh(dayId?: string) {
  revalidatePath("/business/popup");
  if (dayId) revalidatePath(`/business/popup/${dayId}`);
}

export async function createPopupDay(input: {
  starts_at: string;
  ends_at: string | null;
  location: string;
}): Promise<PopupResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };
  const start = new Date(input.starts_at);
  if (Number.isNaN(start.getTime())) return { error: "Pick a date and start time." };
  const end = input.ends_at ? new Date(input.ends_at) : null;
  if (end && (Number.isNaN(end.getTime()) || end <= start)) return { error: "The end needs to be after the start." };

  const supabase = await createClient();
  const { error } = await supabase.from("popup_days").insert({
    org_id: ctx.orgId,
    starts_at: start.toISOString(),
    ends_at: end ? end.toISOString() : null,
    location: input.location.trim() || null,
    created_by: ctx.userId,
  });
  if (error) return { error: "That day did not save. Try again." };
  refresh();
  return { error: null };
}

export async function updatePopupLocation(dayId: string, location: string): Promise<PopupResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("popup_days")
    .update({ location: location.trim() || null })
    .eq("id", dayId);
  if (error) return { error: "The location did not save." };
  refresh(dayId);
  return { error: null };
}

// A person on the pop-up list who has never come gets a guest record the
// first time they are marked here. Reuses a guest with the same email and
// name if one exists.
async function guestForSubscriber(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ctx: { userId: string; orgId: string },
  subscriberId: string,
): Promise<string | null> {
  const { data: sub } = await supabase
    .from("library_subscribers")
    .select("id, email, name, phone")
    .eq("id", subscriberId)
    .maybeSingle();
  if (!sub) return null;
  const name = (sub.name as string | null)?.trim() || (sub.email as string);

  const { data: existing } = await supabase
    .from("popup_guests")
    .select("id, subscriber_id")
    .ilike("email", exact(sub.email as string))
    .ilike("full_name", exact(name))
    .maybeSingle();
  if (existing) {
    if (!existing.subscriber_id) {
      await supabase.from("popup_guests").update({ subscriber_id: sub.id }).eq("id", existing.id);
    }
    return existing.id as string;
  }

  const { data: created } = await supabase
    .from("popup_guests")
    .insert({
      org_id: ctx.orgId,
      full_name: name,
      email: sub.email,
      phone: sub.phone,
      subscriber_id: sub.id,
      created_by: ctx.userId,
    })
    .select("id")
    .single();
  return (created?.id as string | undefined) ?? null;
}

export async function setHere(
  dayId: string,
  who: { guestId: string | null; subscriberId: string | null },
  here: boolean,
): Promise<PopupResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();

  let guestId = who.guestId;
  if (!guestId && who.subscriberId && here) {
    guestId = await guestForSubscriber(supabase, ctx, who.subscriberId);
  }
  if (!guestId) return here ? { error: "Could not mark them here. Try again." } : { error: null };

  if (here) {
    const { error } = await supabase
      .from("popup_attendance")
      .upsert(
        { org_id: ctx.orgId, popup_day_id: dayId, guest_id: guestId, marked_by: ctx.userId },
        { onConflict: "popup_day_id,guest_id", ignoreDuplicates: true },
      );
    if (error) return { error: "Could not mark them here. Try again." };
  } else {
    // Anyone they brought stays here; the link just clears.
    await supabase.from("popup_attendance").update({ brought_by: null }).eq("popup_day_id", dayId).eq("brought_by", guestId);
    const { error } = await supabase.from("popup_attendance").delete().eq("popup_day_id", dayId).eq("guest_id", guestId);
    if (error) return { error: "Could not undo that. Try again." };
  }
  refresh(dayId);
  return { error: null };
}

export async function setCameWith(dayId: string, guestId: string, broughtBy: string | null): Promise<PopupResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };
  if (broughtBy === guestId) return { error: "Pick someone else." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("popup_attendance")
    .update({ brought_by: broughtBy })
    .eq("popup_day_id", dayId)
    .eq("guest_id", guestId);
  if (error) return { error: "That did not save. Try again." };
  refresh(dayId);
  return { error: null };
}

export async function setFreeSession(dayId: string, guestId: string, free: boolean): Promise<PopupResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const { error } = await supabase
    .from("popup_attendance")
    .update({ free_session: free })
    .eq("popup_day_id", dayId)
    .eq("guest_id", guestId);
  if (error) return { error: "That did not save. Try again." };
  refresh(dayId);
  return { error: null };
}

// Record that the guest signed the paper waiver. Stamps the current version;
// the details (emergency contact, photos) stay on the paper.
async function recordPaperWaiver(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ctx: { userId: string; orgId: string },
  guestId: string,
): Promise<string | null> {
  const { data: form } = await supabase
    .from("forms")
    .select("id, version, valid_through")
    .eq("kind", "popup_waiver")
    .eq("is_active", true)
    .maybeSingle();
  if (!form) return "The pop-up waiver is not set up yet.";
  const { error } = await supabase.from("popup_waivers").upsert(
    {
      org_id: ctx.orgId,
      guest_id: guestId,
      form_id: form.id,
      form_version: form.version,
      valid_through: form.valid_through,
      signed_via: "paper",
      recorded_by: ctx.userId,
    },
    { onConflict: "guest_id,form_id,form_version", ignoreDuplicates: true },
  );
  return error ? "The waiver did not save. Try again." : null;
}

export async function markPaperWaiver(dayId: string, guestId: string): Promise<PopupResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };
  const supabase = await createClient();
  const error = await recordPaperWaiver(supabase, ctx, guestId);
  if (error) return { error };
  refresh(dayId);
  return { error: null };
}

export type WalkUpInput = {
  name: string;
  email: string;
  phone: string;
  age: string;
  cameWith: string | null;
  joinList: boolean;
  paperWaiver: boolean;
};

// Someone who shows up without signing up first. Email is required (it is
// how the next Saturday's spot is shared). They join the email list only if
// they said yes. Marked here in the same step.
export async function addWalkUp(dayId: string, input: WalkUpInput): Promise<PopupResult> {
  const ctx = await ownerContext();
  if (!ctx) return { error: "You are signed out." };

  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const phone = input.phone.trim();
  if (!name || name.length > 120) return { error: "Add their name." };
  if (!EMAIL_RE.test(email) || email.length > 254) return { error: "Check the email address." };
  let age: number | null = null;
  if (input.age.trim()) {
    age = Number(input.age);
    if (!Number.isInteger(age) || age < 10 || age > 17) {
      return { error: "Pop-ups are for ages 10 and up. Leave age empty for adults." };
    }
  }

  const supabase = await createClient();

  let subscriberId: string | null = null;
  if (input.joinList) {
    const { data: sub } = await supabase.from("library_subscribers").select("id").ilike("email", exact(email)).maybeSingle();
    if (sub) {
      subscriberId = sub.id as string;
    } else {
      const { data: created, error } = await supabase
        .from("library_subscribers")
        .insert({
          org_id: ctx.orgId,
          email,
          source: "saturday",
          name: age === null ? name : null,
          phone: phone || null,
          added_by: ctx.userId,
        })
        .select("id")
        .single();
      if (error) return { error: "Could not add them to the list. Try again." };
      subscriberId = created.id as string;
    }
  }

  // Reuse the guest if this email and name already came before.
  const { data: existing } = await supabase
    .from("popup_guests")
    .select("id")
    .ilike("email", exact(email))
    .ilike("full_name", exact(name))
    .maybeSingle();
  let guestId = existing?.id as string | undefined;
  if (!guestId) {
    // A minor never links to the list row: it is the parent's.
    let link: string | null = age === null ? subscriberId : null;
    if (link) {
      const { data: taken } = await supabase.from("popup_guests").select("id").eq("subscriber_id", link).maybeSingle();
      if (taken) link = null;
    }
    const { data: created, error } = await supabase
      .from("popup_guests")
      .insert({
        org_id: ctx.orgId,
        full_name: name,
        email,
        phone: phone || null,
        age_if_minor: age,
        subscriber_id: link,
        created_by: ctx.userId,
      })
      .select("id")
      .single();
    if (error) return { error: "Could not add them. Try again." };
    guestId = created.id as string;
  }

  const { error: attErr } = await supabase.from("popup_attendance").upsert(
    {
      org_id: ctx.orgId,
      popup_day_id: dayId,
      guest_id: guestId,
      brought_by: input.cameWith && input.cameWith !== guestId ? input.cameWith : null,
      marked_by: ctx.userId,
    },
    { onConflict: "popup_day_id,guest_id" },
  );
  if (attErr) return { error: "Added, but could not mark them here. Tap Here on their row." };

  if (input.paperWaiver) {
    const wErr = await recordPaperWaiver(supabase, ctx, guestId);
    if (wErr) return { error: `Marked here. ${wErr}` };
  }

  refresh(dayId);
  return { error: null };
}
