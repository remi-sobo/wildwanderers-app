import { createClient } from "@/lib/supabase/server";
import type { BlockType, BlockRecur } from "@/lib/schedule/blocks";

// Readers for the Schedule surface. RLS scopes everything: the owner
// reads the org's blocks, a coach their own, clients and parents none.

export type ScheduleBlock = {
  id: string;
  grp: string;
  day: number;
  start_min: number;
  end_min: number;
  title: string;
  location: string | null;
  description: string | null;
  block_type: BlockType;
  recur: BlockRecur;
};

export type BlockTaskLink = {
  id: string;
  block_id: string;
  task_id: string;
  week_start: string;
  position: number;
};

export type ScheduleSettings = {
  start_hour: number;
  end_hour: number;
  travel_buffer_min: number;
  default_len_min: number;
  default_block_type: BlockType;
  colors: Record<string, string>;
};

export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettings = {
  start_hour: 6,
  end_hour: 22.5,
  travel_buffer_min: 30,
  default_len_min: 30,
  default_block_type: "client",
  colors: {},
};

export async function getScheduleBlocks(): Promise<ScheduleBlock[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("schedule_blocks")
    .select("id, grp, day, start_min, end_min, title, location, description, block_type, recur")
    .order("day", { ascending: true })
    .order("start_min", { ascending: true });
  return (data as ScheduleBlock[] | null) ?? [];
}

// Links for the weeks around now. The server may sit in another
// timezone than the coach, so fetch a wide two-week window and let the
// grid filter to its local Monday key.
export async function getBlockTaskLinks(): Promise<BlockTaskLink[]> {
  const supabase = await createClient();
  const since = new Date();
  since.setDate(since.getDate() - 14);
  const sinceKey = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, "0")}-${String(since.getDate()).padStart(2, "0")}`;
  const { data } = await supabase
    .from("schedule_block_tasks")
    .select("id, block_id, task_id, week_start, position")
    .gte("week_start", sinceKey)
    .order("position", { ascending: true });
  return (data as BlockTaskLink[] | null) ?? [];
}

export async function getMyScheduleSettings(): Promise<ScheduleSettings> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEFAULT_SCHEDULE_SETTINGS;
  const { data } = await supabase
    .from("schedule_settings")
    .select("start_hour, end_hour, travel_buffer_min, default_len_min, default_block_type, colors")
    .eq("profile_id", user.id)
    .maybeSingle();
  if (!data) return DEFAULT_SCHEDULE_SETTINGS;
  return {
    ...DEFAULT_SCHEDULE_SETTINGS,
    ...data,
    start_hour: Number(data.start_hour),
    end_hour: Number(data.end_hour),
    colors: (data.colors as Record<string, string> | null) ?? {},
  };
}
