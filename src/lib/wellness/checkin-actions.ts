"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { getMyClient } from "@/lib/data/training";
import { transcribeAudio } from "@/lib/voice/transcribe";

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

// The client records a voice check-in. We transcribe it with Deepgram, store
// the audio in the private bucket under the client's own folder (RLS), and
// save the transcript as the body so Gabe can read it fast and Coach can
// structure it. The audio is kept for replay.
export async function submitVoiceCheckIn(formData: FormData): Promise<CheckInResult> {
  const session = await getSessionProfile();
  const client = await getMyClient();
  if (!session?.profile || !client) return { error: "You are signed out." };

  const file = formData.get("audio");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "No recording came through. Try again." };
  }

  const bytes = await file.arrayBuffer();

  let transcript = "";
  try {
    transcript = await transcribeAudio(bytes, file.type);
  } catch {
    return { error: "Voice check-ins are not switched on yet. Use text for now." };
  }
  if (!transcript) return { error: "Nothing was picked up. Try again, or use text." };

  const supabase = await createClient();
  const path = `${client.id}/${crypto.randomUUID()}.webm`;
  const { error: upErr } = await supabase.storage
    .from("checkin-audio")
    .upload(path, bytes, { contentType: file.type || "audio/webm", upsert: false });
  const voiceUrl = upErr ? null : path;

  const { error } = await supabase.from("check_ins").insert({
    org_id: session.profile.org_id,
    client_id: client.id,
    kind: "voice",
    body: transcript,
    voice_url: voiceUrl,
    status: "open",
  });
  if (error) return { error: "That did not send. Try again." };

  revalidatePath("/log");
  return { error: null };
}
