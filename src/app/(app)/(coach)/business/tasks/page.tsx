import { redirect } from "next/navigation";

// Tasks grew into the whole-app surface at /tasks; goals moved to
// /business/goals. See specs/unified-tasks.md.
export default function TasksRedirect() {
  redirect("/tasks");
}
