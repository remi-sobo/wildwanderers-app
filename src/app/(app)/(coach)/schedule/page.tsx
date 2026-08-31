import { getScheduleBlocks, getBlockTaskLinks, getMyScheduleSettings } from "@/lib/data/schedule";
import { getTaskList } from "@/lib/data/tasks";
import { ScheduleGrid } from "@/components/coach/ScheduleGrid";

// The Schedule surface: Gabe's recurring work week as a time grid
// (design_handoff_schedule). Staff only, guarded by the (coach) layout;
// RLS decides whose blocks the caller sees. Tasks ride along so Work
// blocks can be filled and checked off without leaving the calendar.
export default async function SchedulePage() {
  const [blocks, links, settings, tasks] = await Promise.all([
    getScheduleBlocks(),
    getBlockTaskLinks(),
    getMyScheduleSettings(),
    getTaskList(),
  ]);

  return <ScheduleGrid blocks={blocks} links={links} settings={settings} tasks={tasks} />;
}
