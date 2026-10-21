import { redirect } from "next/navigation";
import { requireOwnerOrCoach } from "@/lib/auth/require-owner-or-coach";
import { surfaceForRole } from "@/lib/auth/get-profile";
import { getOwnerHq } from "@/lib/flags/owner-hq";
import { getTaskList } from "@/lib/data/tasks";
import { getScheduleBlocks, getBlockTaskLinks } from "@/lib/data/schedule";
import { getSessionsAroundNow } from "@/lib/data/sessions";
import { TodayView } from "@/components/coach/TodayView";

// Today: the owner's landing under the owner HQ layout. Anyone else, or
// the owner on the classic layout, goes to their usual surface.
export default async function TodayPage() {
  const { profile } = await requireOwnerOrCoach();
  const { active } = await getOwnerHq(profile.role);
  if (!active) redirect(surfaceForRole(profile.role));

  const [tasks, blocks, links, sessions] = await Promise.all([
    getTaskList(),
    getScheduleBlocks(),
    getBlockTaskLinks(),
    getSessionsAroundNow(),
  ]);

  return <TodayView tasks={tasks} blocks={blocks} links={links} sessions={sessions} />;
}
