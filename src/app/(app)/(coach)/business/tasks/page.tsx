import { getTasks, getBusinessDashboard } from "@/lib/data/business";
import { TasksPanel } from "@/components/coach/TasksPanel";

export default async function TasksPage() {
  const [tasks, dashboard] = await Promise.all([getTasks(), getBusinessDashboard()]);
  return <TasksPanel tasks={tasks} goals={dashboard.goals} />;
}
