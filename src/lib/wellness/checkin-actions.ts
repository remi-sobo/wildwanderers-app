"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { getMyClient } from "@/lib/data/training";

export type CheckInResult = { error: string | null };

// The client leaves a text check-in for Gabe. Coach structures it later (a
// coach-side, human-approved step); here we just capture the reflection.
export async function submitTextCheckIn(body: string): Promise<CheckInResult> {
  const session = await getSessionProfile();
  const client = await getMyClient();
  if (!session?.profile || !client) return { error: "You are signed out." };

  const text = body.trim();
  if (!text) return { error: "Write a few words first." };
  if (text.length > 4000) return { error: "That is a bit long. Trim it down." };

  const supabase = await createClient();
  const { error } = await supabase.from("check_ins").insert({
    org_id: session.profile.org_id,
    client_id: client.id,
    kind: "text",
    body: text,
    status: "open",
  });
  if (error) return { error: "That did not send. Try again." };

  revalidatePath("/log");
  return { error: null };
}
