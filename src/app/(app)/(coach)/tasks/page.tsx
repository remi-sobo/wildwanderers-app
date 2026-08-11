import { getTaskList, getAllTaskComments, getStaffOptions } from "@/lib/data/tasks";
import { runTaskSweep } from "@/lib/tasks/actions";
import { TasksBoard } from "@/components/coach/TasksBoard";

// The one tasks surface (specs/unified-tasks.md). Staff only, guarded by
// the (coach) layout; RLS decides what each caller sees. The sweep runs
// first so stale-lead and missing-next-step tasks are on the board the
// moment it renders.
export default async function TasksPage() {
  await runTaskSweep();
  const [tasks, commentsByTask, staff] = await Promise.all([
    getTaskList(),
    getAllTaskComments(),
    getStaffOptions(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow text-bark">Tasks</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[26px] leading-tight text-forest-deep">
          What needs doing.
        </h1>
      </div>
      <TasksBoard tasks={tasks} commentsByTask={commentsByTask} staff={staff} />
    </div>
  );
}
