import { getTaskList, getAllTaskComments, getStaffOptions, getTaskBuckets } from "@/lib/data/tasks";
import { getAdvisorAccess, getFromAdvisor, getSharedAdvisorItems } from "@/lib/data/advisor-owner";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { runTaskSweep } from "@/lib/tasks/actions";
import { TasksBoard } from "@/components/coach/TasksBoard";
import { FromAdvisor } from "@/components/coach/FromAdvisor";

// The one tasks surface (specs/unified-tasks.md). Staff only, guarded by
// the (coach) layout; RLS decides what each caller sees. The sweep runs
// first so stale-lead and missing-next-step tasks are on the board the
// moment it renders. The owner also sees what an advisor sent over
// (specs/advisor.md).
export default async function TasksPage() {
  await runTaskSweep();
  const session = await getSessionProfile();
  const isOwner = session?.profile?.role === "owner";
  const [tasks, buckets, commentsByTask, staff, access, fromAdvisor, sharedItems] = await Promise.all([
    getTaskList(),
    getTaskBuckets(),
    getAllTaskComments(),
    getStaffOptions(),
    isOwner ? getAdvisorAccess() : Promise.resolve(null),
    isOwner ? getFromAdvisor() : Promise.resolve([]),
    isOwner ? getSharedAdvisorItems() : Promise.resolve([]),
  ]);
  const advisorSharing = Boolean(access && access.shares.tasks && access.advisors.some((a) => a.active));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow text-bark">Tasks</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[26px] leading-tight text-forest-deep">
          What needs doing.
        </h1>
      </div>
      <FromAdvisor items={fromAdvisor} shared={sharedItems} />
      <TasksBoard
        tasks={tasks}
        buckets={buckets}
        commentsByTask={commentsByTask}
        staff={staff}
        advisorSharing={advisorSharing}
      />
    </div>
  );
}
