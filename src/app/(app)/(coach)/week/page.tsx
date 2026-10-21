import { redirect } from "next/navigation";
import { requireOwnerOrCoach } from "@/lib/auth/require-owner-or-coach";
import { surfaceForRole } from "@/lib/auth/get-profile";
import { getOwnerHq } from "@/lib/flags/owner-hq";
import { getTaskList } from "@/lib/data/tasks";
import { getPicks } from "@/lib/data/week";
import { WeekView } from "@/components/coach/WeekView";

// Week: This Week's Five under the owner HQ layout. Anyone else, or the
// owner on the classic layout, goes to their usual surface.
export default async function WeekPage() {
  const { profile } = await requireOwnerOrCoach();
  const { active } = await getOwnerHq(profile.role);
  if (!active) redirect(surfaceForRole(profile.role));
  const [tasks, picks] = await Promise.all([getTaskList(), getPicks()]);
  return <WeekView tasks={tasks} weeks={picks.weeks} />;
}
