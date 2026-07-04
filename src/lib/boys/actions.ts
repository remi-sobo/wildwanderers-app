"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";

export type BoysResult = { error: string | null; id?: string };

async function staffContext() {
  const session = await getSessionProfile();
  if (!session?.profile || !["owner", "coach"].includes(session.profile.role)) return null;
  return { userId: session.userId, orgId: session.profile.org_id };
}

export async function createProgram(input: {
  name: string;
  location?: string;
  start_date?: string;
  end_date?: string;
}): Promise<BoysResult> {
  const ctx = await staffContext();
  if (!ctx) return { error: "You are signed out." };
  if (!input.name.trim()) return { error: "Give the program a name." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("programs")
    .insert({
      org_id: ctx.orgId,
      name: input.name.trim(),
      status: "active",
      location: input.location?.trim() || null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
    })
    .select("id")
    .single();
  if (error || !data) return { error: "That did not save. Try again." };
  revalidatePath("/boys");
  return { error: null, id: data.id as string };
}
