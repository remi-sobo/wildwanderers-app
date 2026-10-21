import { describe, expect, it } from "vitest";
import type { AdvisorItem, AdvisorTask } from "@/lib/data/advisor";
import { groupWork, taskStatusLine } from "./work";

const item = (id: string, over: Partial<AdvisorItem>): AdvisorItem => ({
  id,
  org_id: "o",
  kind: "todo",
  title: id,
  notes: null,
  vis: "private",
  stage: null,
  status: "open",
  due_date: null,
  created_at: "2026-10-21T00:00:00Z",
  updated_at: "2026-10-21T00:00:00Z",
  ...over,
});
const task = (id: string, over: Partial<AdvisorTask>): AdvisorTask => ({
  id,
  org_id: "o",
  title: id,
  description: null,
  status: "open",
  due_date: null,
  kind: "assignment",
  from_me: true,
  masked: false,
  created_at: "2026-10-21T00:00:00Z",
  updated_at: "2026-10-21T00:00:00Z",
  completed_at: null,
  ...over,
});

describe("groupWork", () => {
  it("splits Mine, the owner's, and Waiting on", () => {
    const g = groupWork(
      [
        item("todo-done", { status: "done" }),
        item("todo", {}),
        item("owe", { kind: "deliverable", vis: "shared", stage: "drafting" }),
        item("ask", { kind: "question", vis: "shared" }),
        item("asked-done", { kind: "question", status: "done" }),
        item("dropped", { status: "dropped" }),
      ],
      [
        task("assigned", {}),
        task("shared", { kind: "task", from_me: false }),
        task("suggested", { kind: "suggestion" }),
        task("declined", { kind: "suggestion", status: "cancelled" }),
        task("accepted", { kind: "task" }),
      ],
    );
    expect(g.mine.map((i) => i.id)).toEqual(["todo", "owe", "todo-done"]);
    expect(g.owners.map((t) => t.id)).toEqual(["assigned", "shared", "accepted", "declined"]);
    expect(g.waiting.questions.map((i) => i.id)).toEqual(["ask"]);
    expect(g.waiting.suggestions.map((t) => t.id)).toEqual(["suggested"]);
  });
});

describe("taskStatusLine", () => {
  it("names the owner, never a hardcoded person", () => {
    expect(taskStatusLine(task("a", { status: "done" }), "Sam")).toBe("Sam finished it");
    expect(taskStatusLine(task("a", { kind: "suggestion" }), "Sam")).toBe("Sam has not decided yet");
    expect(taskStatusLine(task("a", { kind: "suggestion", status: "cancelled" }), "Sam")).toBe("Sam said not now");
    expect(taskStatusLine(task("a", {}), "Sam")).toBe("Open");
  });
});
