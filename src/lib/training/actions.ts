"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { getMyClient } from "@/lib/data/training";

export type ToggleResult = { error: string | null };

// The signed-in client marks an exercise done or not. RLS ensures a client can
// only write their own completions.
export async function setExerciseComplete(
  exerciseId: string,
  complete: boolean,
): Promise<ToggleResult> {
  const session = await getSessionProfile();
  const client = await getMyClient();
  if (!session?.profile || !client) return { error: "You are signed out." };

  const supabase = await createClient();

  if (complete) {
    const { error } = await supabase
      .from("exercise_completions")
      .upsert(
        {
          org_id: session.profile.org_id,
          workout_exercise_id: exerciseId,
          client_id: client.id,
        },
        { onConflict: "workout_exercise_id,client_id", ignoreDuplicates: true },
      );
    if (error) return { error: "That did not save. Try again." };
  } else {
    const { error } = await supabase
      .from("exercise_completions")
      .delete()
      .eq("workout_exercise_id", exerciseId)
      .eq("client_id", client.id);
    if (error) return { error: "That did not save. Try again." };
  }

  revalidatePath("/training");
  revalidatePath("/home");
  return { error: null };
}
