"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth/require-owner";
import { getMyOrg } from "@/lib/data/org";
import { auditLog } from "@/lib/audit/log";
import { sendLibraryNote } from "@/lib/library/email";

export type SendNoteResult = { ok: boolean; sent: number; error: string | null };

// Gather the org's real recipients: signed-in members (clients and families)
// and public subscribers. Emails only, deduped case-insensitively. No fabricated
// addresses: an empty org sends to no one and says so.
async function gatherRecipients(
  admin: ReturnType<typeof createAdminClient>,
  orgId: string,
): Promise<string[]> {
  const emails = new Set<string>();

  // Members: profiles in this org with a member role, matched to their auth
  // email. listUsers is the supported way to read auth emails with the service
  // role; we filter to this org's member ids.
  const { data: memberProfiles } = await admin
    .from("profiles")
    .select("id")
    .eq("org_id", orgId)
    .in("role", ["client", "parent"]);
  const memberIds = new Set((memberProfiles ?? []).map((p: { id: string }) => p.id));

  if (memberIds.size > 0) {
    const { data: usersPage } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    for (const u of usersPage?.users ?? []) {
      if (u.email && memberIds.has(u.id)) emails.add(u.email.toLowerCase());
    }
  }

  // Public subscribers for this org.
  const { data: subs } = await admin
    .from("library_subscribers")
    .select("email")
    .eq("org_id", orgId);
  for (const s of (subs ?? []) as { email: string }[]) {
    if (s.email) emails.add(s.email.toLowerCase());
  }

  return Array.from(emails);
}

// Send a published post as the weekly note, app-side, to members and
// subscribers. Owner only. Records the send and stamps the post so the composer
// can show a sent state and confirm before a resend.
export async function sendWeeklyNote(postId: string): Promise<SendNoteResult> {
  const { profile } = await requireOwner();
  const orgId = profile.org_id;
  if (!orgId) return { ok: false, sent: 0, error: "Your account is not attached to an org yet." };

  const admin = createAdminClient();

  const { data: post } = await admin
    .from("posts")
    .select("id, title, body, external_link, status, org_id")
    .eq("id", postId)
    .maybeSingle();

  if (!post || post.org_id !== orgId) return { ok: false, sent: 0, error: "That post was not found." };
  if (post.status !== "published") {
    return { ok: false, sent: 0, error: "Publish the post first, then send it as the weekly note." };
  }

  const org = await getMyOrg();
  const base = process.env.NEXT_PUBLIC_MARKETING_URL || "https://wildwanderers.life";
  const recipients = await gatherRecipients(admin, orgId);

  const result = await sendLibraryNote(recipients, {
    title: post.title,
    body: post.body,
    externalLink: post.external_link,
    orgName: org?.name || "Wild Wanderers",
    libraryUrl: `${base.replace(/\/$/, "")}/trailhead`,
  });

  if (!result.ok) return result;

  // Record the send and stamp the post. Best-effort past a successful send.
  const sentAt = new Date().toISOString();
  await admin.from("posts").update({ email_sent_at: sentAt }).eq("id", postId);
  await admin.from("library_email_sends").insert({
    org_id: orgId,
    post_id: postId,
    recipient_count: result.sent,
    sent_by: profile.id,
  });
  await auditLog({
    actorId: profile.id,
    orgId,
    action: "library.email_send",
    entityTable: "posts",
    entityId: postId,
    metadata: { recipient_count: result.sent },
  });

  revalidatePath("/library");
  return result;
}
