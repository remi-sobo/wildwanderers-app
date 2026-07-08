import { createClient } from "@/lib/supabase/server";
import { getSessionProfile } from "@/lib/auth/get-profile";

export type ThreadSummary = {
  id: string;
  client_id: string | null;
  guardian_id: string | null;
  coach_id: string;
  other_name: string;
  last_message_preview: string | null;
  last_message_at: string | null;
};

export type Message = {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_role: string;
  content: string;
  created_at: string;
};

export type StaffPerson = { id: string; first_name: string; role: "owner" | "coach" };

// The org's staff, first name and role only, through the definer helper.
// This is the whole directory a member ever sees.
export async function getStaffDirectory(): Promise<StaffPerson[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("org_staff_directory");
  return (data as StaffPerson[] | null) ?? [];
}

// Threads visible to the current user, newest activity first, with the other
// party's real name both directions: staff see the client or family, members
// see the coach's first name from the directory.
export async function getThreads(): Promise<ThreadSummary[]> {
  const supabase = await createClient();
  const session = await getSessionProfile();
  const role = session?.profile?.role;
  const isStaff = role === "owner" || role === "coach";

  const { data: threads } = await supabase
    .from("message_threads")
    .select("id, client_id, guardian_id, coach_id, last_message_preview, last_message_at")
    .order("last_message_at", { ascending: false });

  if (!threads || threads.length === 0) return [];

  const nameById = new Map<string, string>();
  if (isStaff) {
    const clientIds = threads.map((t) => t.client_id as string | null).filter(Boolean) as string[];
    const guardianIds = threads
      .map((t) => t.guardian_id as string | null)
      .filter(Boolean) as string[];
    const [{ data: clients }, { data: guardians }] = await Promise.all([
      clientIds.length
        ? supabase.from("clients").select("id, first_name, last_name").in("id", clientIds)
        : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string }[] }),
      guardianIds.length
        ? supabase.from("guardians").select("id, first_name, last_name").in("id", guardianIds)
        : Promise.resolve({ data: [] as { id: string; first_name: string; last_name: string }[] }),
    ]);
    for (const c of clients ?? []) {
      nameById.set(
        `c:${c.id}`,
        [c.first_name, c.last_name].filter(Boolean).join(" ").trim() || "Client",
      );
    }
    for (const g of guardians ?? []) {
      nameById.set(
        `g:${g.id}`,
        ([g.first_name, g.last_name].filter(Boolean).join(" ").trim() || "Family") + " (family)",
      );
    }
  } else {
    const staff = await getStaffDirectory();
    for (const s of staff) nameById.set(`s:${s.id}`, s.first_name);
  }

  return threads.map((t) => ({
    id: t.id as string,
    client_id: (t.client_id as string | null) ?? null,
    guardian_id: (t.guardian_id as string | null) ?? null,
    coach_id: t.coach_id as string,
    other_name: isStaff
      ? t.client_id
        ? nameById.get(`c:${t.client_id}`) ?? "Client"
        : nameById.get(`g:${t.guardian_id}`) ?? "Family"
      : nameById.get(`s:${t.coach_id}`) ?? "Your coach",
    last_message_preview: (t.last_message_preview as string | null) ?? null,
    last_message_at: (t.last_message_at as string | null) ?? null,
  }));
}

export async function getMessages(threadId: string): Promise<Message[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("messages")
    .select("id, thread_id, sender_id, sender_role, content, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  return (data as Message[] | null) ?? [];
}

export type MessageableGuardian = { id: string; name: string };

// The org's families with a login, for the staff compose picker. Staff RLS
// scopes the read; a family without a login cannot receive yet, so it is
// left out of the picker.
export async function getMessageableGuardians(): Promise<MessageableGuardian[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("guardians")
    .select("id, first_name, last_name, user_id")
    .not("user_id", "is", null)
    .order("last_name", { ascending: true });
  return ((data ?? []) as { id: string; first_name: string; last_name: string }[]).map((g) => ({
    id: g.id,
    name: [g.first_name, g.last_name].filter(Boolean).join(" ").trim() || "Family",
  }));
}
