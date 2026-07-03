import { createClient } from "@/lib/supabase/server";
import { getMyClient } from "@/lib/data/training";
import { createAdminClient } from "@/lib/supabase/admin";

export type CheckInStructured = {
  summary?: string;
  mood?: string;
  wins?: string[];
  blockers?: string[];
  focus?: string;
} | null;

export type CheckIn = {
  id: string;
  created_at: string;
  kind: "text" | "voice";
  body: string | null;
  voice_url: string | null;
  // A short-lived playback URL, resolved for the coach view when configured.
  voice_signed_url?: string | null;
  structured: CheckInStructured;
  status: "open" | "reviewed" | "archived";
};

// The signed-in client's own recent check-ins.
export async function getMyCheckIns(limit = 5): Promise<CheckIn[]> {
  const client = await getMyClient();
  if (!client) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("check_ins")
    .select("id, created_at, kind, body, voice_url, structured, status")
    .eq("client_id", client.id)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data as CheckIn[] | null) ?? [];
}

// A client's check-ins for the coach (RLS scopes to the coach's org). Voice
// entries get a short-lived signed playback URL, resolved through the admin
// chokepoint since the audio bucket is client-owned. Best-effort: without a
// service key the transcript still shows, just no playback.
export async function getClientCheckIns(clientId: string, limit = 10): Promise<CheckIn[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("check_ins")
    .select("id, created_at, kind, body, voice_url, structured, status")
    .eq("client_id", clientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = (data as CheckIn[] | null) ?? [];
  const voicePaths = rows.filter((r) => r.kind === "voice" && r.voice_url).map((r) => r.voice_url!);
  if (voicePaths.length === 0 || !process.env.SUPABASE_SERVICE_ROLE_KEY) return rows;

  try {
    const admin = createAdminClient();
    const signed = new Map<string, string>();
    await Promise.all(
      voicePaths.map(async (path) => {
        const { data: s } = await admin.storage.from("checkin-audio").createSignedUrl(path, 3600);
        if (s?.signedUrl) signed.set(path, s.signedUrl);
      }),
    );
    return rows.map((r) =>
      r.voice_url && signed.has(r.voice_url) ? { ...r, voice_signed_url: signed.get(r.voice_url) } : r,
    );
  } catch {
    return rows;
  }
}
