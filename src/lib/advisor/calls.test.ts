import { describe, expect, it } from "vitest";
import { buildAgenda, itemKey, matchProposal, sendPreview, similarity, type CallItem } from "./calls";

const item = (id: string, over: Partial<CallItem>): CallItem => ({
  id,
  section: "owner",
  text: id,
  owner: "owner",
  due_date: null,
  quote: null,
  quote_at: null,
  flag: null,
  match_task_id: null,
  state: "accepted",
  send_as: "assignment",
  keep_private: false,
  sent_task_id: null,
  ...over,
});

describe("itemKey", () => {
  it("is stable across case, punctuation and filler words", () => {
    expect(itemKey("owner", "Send the waiver to families.")).toBe(itemKey("owner", "send waiver families"));
    expect(itemKey("owner", "Send the waiver")).not.toBe(itemKey("advisor", "Send the waiver"));
    expect(itemKey("owner", "Send the waiver")).not.toBe(itemKey("owner", "Print the waiver"));
  });
});

describe("matching", () => {
  const candidates = [
    { id: "open", title: "Send the pop-up waiver to families", done: false, masked: false },
    { id: "done", title: "Publish fall prices on the site", done: true, masked: false },
    { id: "hidden", title: "A client task · details not shared with you", done: false, masked: true },
  ];

  it("flags close matches to open work as already in the app", () => {
    expect(matchProposal("Send families the pop-up waiver", candidates)).toEqual({ flag: "already_in_app", matchId: "open" });
  });

  it("flags close matches to finished work as possibly done", () => {
    expect(matchProposal("Publish the fall prices on the site", candidates)).toEqual({ flag: "possibly_done", matchId: "done" });
  });

  it("does not match loosely related work, and never a masked task", () => {
    expect(matchProposal("Call the venue about parking", candidates)).toBeNull();
    expect(matchProposal("A client task details not shared with you", candidates)).toBeNull();
    expect(similarity("", "x")).toBe(0);
  });
});

describe("sendPreview", () => {
  it("shows exactly what the owner will get, and what is held back", () => {
    const p = sendPreview([
      item("assign", {}),
      item("suggest", { send_as: "suggestion" }),
      item("unclear", { owner: "unclear" }),
      item("unclear-linked", { owner: "unclear", match_task_id: "t2" }),
      item("no-mode", { send_as: null }),
      item("private", { keep_private: true }),
      item("mine", { section: "advisor", owner: "advisor", send_as: null }),
      item("decided", { section: "decided", send_as: null }),
      item("linked", { match_task_id: "t1" }),
      item("proposed", { state: "proposed" }),
      item("removed", { state: "removed" }),
    ]);
    expect(p.toOwner.map((i) => i.id)).toEqual(["assign", "suggest"]);
    expect(p.toMe.map((i) => i.id)).toEqual(["private", "mine"]);
    expect(p.onRecord.map((i) => i.id)).toEqual(["decided"]);
    expect(p.linked.map((i) => i.id)).toEqual(["linked"]);
    expect(p.held.map((i) => i.id)).toEqual(["unclear", "unclear-linked", "no-mode"]);
  });
});

describe("buildAgenda", () => {
  it("builds from real work, naming the owner", () => {
    const text = buildAgenda({
      ownerName: "Sam",
      lastCallOn: "2026-10-14",
      tasks: [
        { title: "Old win", status: "done", kind: "assignment", from_me: true, masked: false, completed_at: "2026-10-01T10:00:00Z" },
        { title: "Price sheet", status: "done", kind: "assignment", from_me: true, masked: false, completed_at: "2026-10-18T10:00:00Z" },
        { title: "Referral card", status: "open", kind: "suggestion", from_me: true, masked: false, completed_at: null },
        { title: "Park permit", status: "open", kind: "assignment", from_me: true, masked: false, completed_at: null },
        { title: "Shared task", status: "open", kind: "task", from_me: false, masked: false, completed_at: null },
      ],
      items: [
        { title: "Which Saturday?", kind: "question", status: "open", stage: null },
        { title: "One-pager", kind: "deliverable", status: "open", stage: "ready" },
      ],
    });
    expect(text).toContain("Finished since the last call\n- Price sheet");
    expect(text).not.toContain("Old win");
    expect(text).toContain("Still open for Sam\n- Park permit");
    expect(text).toContain("Suggestions Sam has not decided on\n- Referral card");
    expect(text).toContain("Questions for Sam\n- Which Saturday?");
    expect(text).toContain("What I owe\n- One-pager (ready)");
    expect(text).not.toContain("Shared task");
    expect(text).not.toMatch(/—/);
  });

  it("says so when there is nothing", () => {
    expect(buildAgenda({ ownerName: "Sam", lastCallOn: null, tasks: [], items: [] })).toMatch(/Nothing open/);
  });
});
