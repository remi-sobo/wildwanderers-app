import { getTaskList } from "@/lib/data/tasks";
import { getBusinessDashboard } from "@/lib/data/business";
import { TasksPanel } from "@/components/coach/TasksPanel";

// Kept as the owner's tasks-and-goals view until the /tasks surface lands
// (Phase 3 of specs/unified-tasks.md redirects this page there).
export default async function TasksPage() {
  const [tasks, dashboard] = await Promise.all([getTaskList(), getBusinessDashboard()]);
  return <TasksPanel tasks={tasks} goals={dashboard.goals} />;
}
