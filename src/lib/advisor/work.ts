// Pure grouping for the advisor's Work screen (specs/advisor.md): Mine,
// the owner's, and Waiting on. No server imports; unit tested.

import type { AdvisorItem, AdvisorTask } from "@/lib/data/advisor";

export type WorkGroups = {
  /** The advisor's own to-dos and what they owe the owner, open first. */
  mine: AdvisorItem[];
  /** Work in the owner's tasks: what the advisor sent, and what was shared. */
  owners: AdvisorTask[];
  /** Open questions for the owner, and suggestions still undecided. */
  waiting: { questions: AdvisorItem[]; suggestions: AdvisorTask[] };
};

const openFirst = <T extends { status: string }>(a: T, b: T) =>
  Number(a.status !== "open" && a.status !== "in_progress") - Number(b.status !== "open" && b.status !== "in_progress");

export function groupWork(items: AdvisorItem[], tasks: AdvisorTask[]): WorkGroups {
  const live = items.filter((i) => i.status !== "dropped");
  return {
    mine: live.filter((i) => i.kind === "todo" || i.kind === "deliverable").sort(openFirst),
    owners: tasks.filter((t) => !(t.kind === "suggestion" && t.status !== "cancelled")).sort(openFirst),
    waiting: {
      questions: live.filter((i) => i.kind === "question" && i.status === "open"),
      suggestions: tasks.filter((t) => t.kind === "suggestion" && t.status !== "cancelled"),
    },
  };
}

/** What the advisor sees about one of the owner's tasks. */
export function taskStatusLine(t: AdvisorTask, ownerName: string): string {
  if (t.status === "done") return `${ownerName} finished it`;
  if (t.status === "cancelled") return t.kind === "suggestion" ? `${ownerName} said not now` : "Set aside";
  if (t.kind === "suggestion") return `${ownerName} has not decided yet`;
  if (t.status === "in_progress") return `${ownerName} is on it`;
  return "Open";
}
