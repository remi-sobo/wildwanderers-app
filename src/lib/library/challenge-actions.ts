"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { getMyClient } from "@/lib/data/training";

export type CompletionResult = { ok: boolean; error: string | null };

// A signed-in fitness client marks the weekly challenge done, or undoes it. RLS
// (client_manages_own_completion) means a client can only ever write their own
// row, and the posts.completion_count trigger keeps the public tally true.
// Families read the challenge but do not complete it; only a client has a
// client record to attach a completion to.
export async function setChallengeDone(
  postId: string,
  done: boolean,
): Promise<CompletionResult> {
  const session = await getSessionProfile();
  if (!session?.profile || session.profile.role !== "client") {
    return { ok: false, error: "Only a client can mark the challenge done." };
  }
  const client = await getMyClient();
  if (!client) return { ok: false, error: "You are signed out." };

  const supabase = await createClient();

  if (done) {
    const { error } = await supabase.from("post_challenge_completions").upsert(
      {
        org_id: session.profile.org_id,
        post_id: postId,
        client_id: client.id,
      },
      { onConflict: "post_id,client_id", ignoreDuplicates: true },
    );
    if (error) return { ok: false, error: "That did not save. Try again." };
  } else {
    const { error } = await supabase
      .from("post_challenge_completions")
      .delete()
      .eq("post_id", postId)
      .eq("client_id", client.id);
    if (error) return { ok: false, error: "That did not save. Try again." };
  }

  revalidatePath("/trailhead");
  return { ok: true, error: null };
}
