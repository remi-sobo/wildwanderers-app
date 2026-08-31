// The program dimension of the task system, shared by server readers and
// client components. Keep this module free of server imports; it ships in
// the client bundle.

export type TaskProgram = "fitness" | "boys" | "general";

export const PROGRAMS: TaskProgram[] = ["fitness", "boys", "general"];

export const PROGRAM_LABEL: Record<TaskProgram, string> = {
  fitness: "Fitness",
  boys: "Boys Program",
  general: "General",
};
