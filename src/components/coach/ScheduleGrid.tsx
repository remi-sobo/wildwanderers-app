"use client";

// The week as a time grid (design_handoff_schedule). Drag on empty grid
// to draw a block, drag a block to move it (across days too), pull its
// bottom edge to resize, click to edit. A repeat group is one event on
// several days: the editor's day squares are its membership, and every
// field except task links syncs across the group. Work blocks carry
// this week's tasks: fill from the pinned-first list, check off on the
// block (completion goes through the task system), and an expired work
// block's open tasks roll to the top of the next one. Monday resets the
// links; the blocks persist.

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import {
  createBlock,
  updateGroup,
  moveBlock,
  setGroupDays,
  deleteGroup,
  linkTaskToBlock,
  unlinkTask,
} from "@/lib/schedule/actions";
import { setTaskDone } from "@/lib/tasks/actions";
import {
  BLOCK_TYPES,
  RECURS,
  DAY_LABELS,
  typeColor,
  formatRange,
  formatMinutes,
  weekStartKey,
  type BlockType,
} from "@/lib/schedule/blocks";
import type { ScheduleBlock, BlockTaskLink, ScheduleSettings } from "@/lib/data/schedule";
import type { TaskListItem } from "@/lib/data/tasks";

const HOUR_H = 56;
const PX_PER_MIN = HOUR_H / 60;
const SNAP = 15;
const GUTTER = 64;

const PRIORITY_PILL: Record<string, string> = {
  urgent: "#b4472e",
  high: "#bf6f1c",
  medium: "#6b4a2e",
  low: "#9c9482",
};

type Draft = { day: number; start: number; end: number };
type DragState =
  | { kind: "create"; day: number; anchor: number; draft: Draft }
  | { kind: "move"; id: string; grabOffset: number; day: number; start: number; len: number; moved: boolean }
  | { kind: "resize"; id: string; day: number; start: number; end: number; moved: boolean };

type EditorState = {
  blockId: string;
  grp: string;
  title: string;
  location: string;
  description: string;
  block_type: BlockType;
  recur: string;
  start_min: number;
  end_min: number;
  days: number[];
  confirmDelete: boolean;
};

function snap(min: number): number {
  return Math.round(min / SNAP) * SNAP;
}

// Overlapping blocks share the column: chains of overlap form a
// cluster, greedy lanes inside it, equal widths (the prototype's
// layout, kept verbatim).
function layoutDay(blocks: ScheduleBlock[]): { b: ScheduleBlock; lane: number; lanes: number }[] {
  const sorted = [...blocks].sort((a, b) => a.start_min - b.start_min || a.end_min - b.end_min);
  const out: { b: ScheduleBlock; lane: number; lanes: number }[] = [];
  let cluster: ScheduleBlock[] = [];
  let clusterEnd = -1;
  const flush = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = [];
    const placed = cluster.map((b) => {
      let lane = laneEnds.findIndex((end) => end <= b.start_min);
      if (lane < 0) {
        lane = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[lane] = b.end_min;
      return { b, lane };
    });
    for (const p of placed) out.push({ ...p, lanes: laneEnds.length });
    cluster = [];
    clusterEnd = -1;
  };
  for (const b of sorted) {
    if (cluster.length > 0 && b.start_min >= clusterEnd) flush();
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, b.end_min);
  }
  flush();
  return out;
}

export function ScheduleGrid({
  blocks,
  links,
  settings,
  tasks,
}: {
  blocks: ScheduleBlock[];
  links: BlockTaskLink[];
  settings: ScheduleSettings;
  tasks: TaskListItem[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [toast, setToast] = useState<{ day: number; start: number; end: number } | null>(null);
  // Set after mount: the viewer's local week and clock, never the server's.
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [nowStamp, setNowStamp] = useState<{ day: number; min: number } | null>(null);
  const columnsRef = useRef<HTMLDivElement>(null);
  const rolloverBusy = useRef(false);
  // Mirrors drag for the pointer-up handler: side effects must not run
  // inside a state updater (StrictMode may invoke updaters twice).
  const dragRef = useRef<DragState | null>(null);
  dragRef.current = drag;

  const gridStart = Math.round(settings.start_hour * 60);
  const gridEnd = Math.round(settings.end_hour * 60);
  const gridHeight = (gridEnd - gridStart) * PX_PER_MIN;

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setWeekStart(weekStartKey(now));
      setNowStamp({ day: (now.getDay() + 6) % 7, min: now.getHours() * 60 + now.getMinutes() });
    };
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  const taskById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const blockById = useMemo(() => new Map(blocks.map((b) => [b.id, b])), [blocks]);
  const weekLinks = useMemo(
    () => (weekStart ? links.filter((l) => l.week_start === weekStart) : []),
    [links, weekStart],
  );
  const linksByBlock = useMemo(() => {
    const m = new Map<string, BlockTaskLink[]>();
    for (const l of weekLinks) {
      const list = m.get(l.block_id);
      if (list) list.push(l);
      else m.set(l.block_id, [l]);
    }
    for (const list of m.values()) list.sort((a, b) => a.position - b.position);
    return m;
  }, [weekLinks]);

  // Rollover: an expired work block's open tasks move to the top of the
  // next upcoming work block of the week. Done tasks stay as the record.
  useEffect(() => {
    if (!weekStart || !nowStamp || rolloverBusy.current) return;
    const admin = blocks
      .filter((b) => b.block_type === "admin")
      .sort((a, b) => a.day - b.day || a.start_min - b.start_min);
    const expired = admin.filter(
      (b) => b.day < nowStamp.day || (b.day === nowStamp.day && b.end_min <= nowStamp.min),
    );
    const next = admin.find(
      (b) => b.day > nowStamp.day || (b.day === nowStamp.day && b.end_min > nowStamp.min),
    );
    if (!next || expired.length === 0) return;
    const moves: string[] = [];
    for (const b of expired) {
      for (const l of linksByBlock.get(b.id) ?? []) {
        const t = taskById.get(l.task_id);
        if (t && t.status !== "done" && t.status !== "cancelled") moves.push(l.task_id);
      }
    }
    if (moves.length === 0) return;
    rolloverBusy.current = true;
    const minPos = Math.min(0, ...(linksByBlock.get(next.id) ?? []).map((l) => l.position));
    start(async () => {
      for (let i = 0; i < moves.length; i++) {
        await linkTaskToBlock(next.id, moves[i], weekStart, minPos - moves.length + i);
      }
      router.refresh();
      rolloverBusy.current = false;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, nowStamp, blocks, linksByBlock]);

  function run(fn: () => Promise<{ error: string | null }>, after?: () => void) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (res.error) setError(res.error);
      else {
        after?.();
        router.refresh();
      }
    });
  }

  function openEditor(b: ScheduleBlock) {
    const days = blocks.filter((x) => x.grp === b.grp).map((x) => x.day).sort((a, z) => a - z);
    setEditor({
      blockId: b.id,
      grp: b.grp,
      title: b.title,
      location: b.location ?? "",
      description: b.description ?? "",
      block_type: b.block_type,
      recur: b.recur,
      start_min: b.start_min,
      end_min: b.end_min,
      days,
      confirmDelete: false,
    });
  }

  // Save the editor's fields to the whole group, then day membership.
  function closeEditor(save: boolean) {
    const e = editor;
    setEditor(null);
    if (!e || !save) return;
    const original = blockById.get(e.blockId);
    if (!original) return;
    const originalDays = blocks.filter((x) => x.grp === e.grp).map((x) => x.day).sort((a, z) => a - z);
    const daysChanged = originalDays.join() !== [...e.days].sort((a, z) => a - z).join();
    start(async () => {
      const res = await updateGroup(e.grp, {
        title: e.title,
        location: e.location,
        description: e.description,
        block_type: e.block_type,
        recur: e.recur,
        start_min: e.start_min,
        end_min: e.end_min,
      });
      if (res.error) {
        setError(res.error);
        return;
      }
      if (daysChanged) {
        const res2 = await setGroupDays(e.grp, e.days);
        if (res2.error) setError(res2.error);
      }
      router.refresh();
    });
  }

  // ── Pointer plumbing ───────────────────────────────────────
  function pointFromEvent(clientX: number, clientY: number): { day: number; min: number } | null {
    const el = columnsRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const day = Math.max(0, Math.min(6, Math.floor((x / rect.width) * 7)));
    const min = gridStart + (clientY - rect.top) / PX_PER_MIN;
    return { day, min: Math.max(gridStart, Math.min(gridEnd, min)) };
  }

  function onGridPointerDown(ev: React.PointerEvent) {
    if (ev.button !== 0 || editor || drag) return;
    const p = pointFromEvent(ev.clientX, ev.clientY);
    if (!p) return;
    const anchor = snap(p.min);
    setDrag({ kind: "create", day: p.day, anchor, draft: { day: p.day, start: anchor, end: anchor + SNAP } });
  }

  function onBlockPointerDown(ev: React.PointerEvent, b: ScheduleBlock) {
    if (ev.button !== 0) return;
    ev.stopPropagation();
    const target = ev.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const withinResize = ev.clientY >= rect.bottom - 7;
    const p = pointFromEvent(ev.clientX, ev.clientY);
    if (!p) return;
    if (withinResize) {
      setDrag({ kind: "resize", id: b.id, day: b.day, start: b.start_min, end: b.end_min, moved: false });
    } else {
      setDrag({
        kind: "move",
        id: b.id,
        grabOffset: p.min - b.start_min,
        day: b.day,
        start: b.start_min,
        len: b.end_min - b.start_min,
        moved: false,
      });
    }
  }

  useEffect(() => {
    if (!drag) return;
    function onMove(ev: PointerEvent) {
      const p = pointFromEvent(ev.clientX, ev.clientY);
      if (!p) return;
      setDrag((d) => {
        if (!d) return d;
        if (d.kind === "create") {
          const m = snap(p.min);
          const startMin = Math.min(d.anchor, m);
          const endMin = Math.max(d.anchor, m);
          return { ...d, draft: { day: p.day, start: startMin, end: Math.max(endMin, startMin + SNAP) } };
        }
        if (d.kind === "move") {
          const startMin = Math.max(gridStart, Math.min(gridEnd - d.len, snap(p.min - d.grabOffset)));
          return { ...d, day: p.day, start: startMin, moved: true };
        }
        const endMin = Math.max(d.start + SNAP, snap(p.min));
        return { ...d, end: Math.min(endMin, gridEnd), moved: true };
      });
    }
    function onUp() {
      const d = dragRef.current;
      setDrag(null);
      if (!d) return;
      if (d.kind === "create") {
        const draft = d.draft;
        const len = Math.max(draft.end - draft.start, SNAP);
        const useDefault = len <= SNAP;
        const startMin = draft.start;
        const endMin = useDefault ? Math.min(startMin + settings.default_len_min, gridEnd) : draft.end;
        start(async () => {
          const res = await createBlock({
            day: draft.day,
            start_min: startMin,
            end_min: endMin,
            title: "New block",
            block_type: settings.default_block_type,
          });
          if (res.error) setError(res.error);
          else if (res.block) {
            router.refresh();
            openEditorForCreated(res.block);
          }
        });
      } else if (d.kind === "move") {
        if (d.moved) run(() => moveBlock(d.id, { day: d.day, start_min: d.start, end_min: d.start + d.len }));
        else {
          const b = blockById.get(d.id);
          if (b) openEditor(b);
        }
      } else if (d.kind === "resize") {
        if (d.moved) run(() => moveBlock(d.id, { day: d.day, start_min: d.start, end_min: d.end }));
        else {
          const b = blockById.get(d.id);
          if (b) openEditor(b);
        }
      }
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag != null, settings.default_block_type, settings.default_len_min]);

  function openEditorForCreated(b: ScheduleBlock) {
    setEditor({
      blockId: b.id,
      grp: b.grp,
      title: b.title,
      location: b.location ?? "",
      description: b.description ?? "",
      block_type: b.block_type,
      recur: b.recur,
      start_min: b.start_min,
      end_min: b.end_min,
      days: [b.day],
      confirmDelete: false,
    });
    // Travel suggestion, suggest-and-confirm: only after a session-type
    // block, only when the slot after it is free.
    if (
      ["client", "group", "ww"].includes(b.block_type) &&
      settings.travel_buffer_min > 0 &&
      b.end_min + settings.travel_buffer_min <= gridEnd &&
      !blocks.some((x) => x.day === b.day && x.start_min < b.end_min + settings.travel_buffer_min && x.end_min > b.end_min)
    ) {
      setToast({ day: b.day, start: b.end_min, end: b.end_min + settings.travel_buffer_min });
    }
  }

  // ── Editor helpers ─────────────────────────────────────────
  const timeOptions = useMemo(() => {
    const out: number[] = [];
    for (let m = gridStart; m <= gridEnd; m += SNAP) out.push(m);
    return out;
  }, [gridStart, gridEnd]);

  const editorBlock = editor ? blockById.get(editor.blockId) ?? null : null;
  const editorLinks = editor ? (linksByBlock.get(editor.blockId) ?? []) : [];
  const editorLinkedIds = new Set(editorLinks.map((l) => l.task_id));
  // Where each open task sits this week, for "On Wed, tap to move".
  const taskWeekHome = useMemo(() => {
    const m = new Map<string, string>();
    for (const l of weekLinks) m.set(l.task_id, l.block_id);
    return m;
  }, [weekLinks]);

  const fillList = useMemo(() => {
    if (!editor || editor.block_type !== "admin") return [];
    const prioRank: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };
    return tasks
      .filter((t) => t.status !== "done" && t.status !== "cancelled")
      .sort((a, b) => {
        if (a.pin_today !== b.pin_today) return a.pin_today ? -1 : 1;
        const p = (prioRank[a.priority] ?? 2) - (prioRank[b.priority] ?? 2);
        if (p !== 0) return p;
        if (a.due_date && b.due_date && a.due_date !== b.due_date) return a.due_date < b.due_date ? -1 : 1;
        if (Boolean(a.due_date) !== Boolean(b.due_date)) return a.due_date ? -1 : 1;
        return 0;
      });
  }, [editor, tasks]);

  function toggleFill(taskId: string) {
    if (!editor || !weekStart) return;
    if (editorLinkedIds.has(taskId)) {
      run(() => unlinkTask(taskId, weekStart));
    } else {
      const nextPos = editorLinks.length > 0 ? Math.max(...editorLinks.map((l) => l.position)) + 1 : 0;
      run(() => linkTaskToBlock(editor.blockId, taskId, weekStart, nextPos));
    }
  }

  // ── Render helpers ─────────────────────────────────────────
  function renderBlock(b: ScheduleBlock, lane: number, lanes: number) {
    const isDragged = drag && drag.kind !== "create" && drag.id === b.id && drag.moved;
    const startMin = isDragged ? (drag.kind === "move" ? drag.start : drag.start) : b.start_min;
    const endMin = isDragged
      ? drag.kind === "move"
        ? drag.start + drag.len
        : drag.end
      : b.end_min;
    const day = isDragged && drag.kind === "move" ? drag.day : b.day;
    if (day !== b.day && !isDragged) return null;
    const top = (startMin - gridStart) * PX_PER_MIN;
    const height = Math.max((endMin - startMin) * PX_PER_MIN, 14);
    const color = typeColor(b.block_type, settings.colors);
    const recurSuffix = RECURS.find((r) => r.key === b.recur)?.suffix ?? "";
    const blockLinks = linksByBlock.get(b.id) ?? [];
    return (
      <div
        key={b.id}
        onPointerDown={(ev) => onBlockPointerDown(ev, b)}
        role="button"
        aria-label={`${b.title}, ${formatRange(startMin, endMin)}`}
        className="absolute select-none overflow-hidden"
        style={{
          top,
          height,
          left: `calc(${(lane / lanes) * 100}% + 2px)`,
          width: `calc(${(1 / lanes) * 100}% - 4px)`,
          background: `color-mix(in srgb, ${color} 16%, #fdfbf5)`,
          borderLeft: `3px solid ${color}`,
          borderRadius: 6,
          boxShadow: "0 1px 2px rgba(42,33,24,.08)",
          padding: "4px 8px",
          cursor: isDragged ? "grabbing" : "grab",
          zIndex: isDragged ? 30 : 10,
        }}
      >
        <p className="truncate text-[12px] font-bold leading-tight text-ink">{b.title}</p>
        {height >= 40 ? (
          <p className="truncate text-[11px] text-[color:var(--color-text-muted)]">
            {formatRange(startMin, endMin)}
            {recurSuffix ? ` ${recurSuffix}` : ""}
          </p>
        ) : null}
        {height >= 56 && b.location ? (
          <p className="truncate text-[10.5px] text-[color:var(--color-text-muted)]">@ {b.location}</p>
        ) : null}
        {b.block_type === "admin" && height >= 58 && blockLinks.length > 0 ? (
          <ul className="mt-1 flex flex-col gap-0.5">
            {blockLinks.map((l) => {
              const t = taskById.get(l.task_id);
              if (!t) return null;
              const doneTask = t.status === "done";
              return (
                <li key={l.id} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={pending}
                    aria-label={doneTask ? `Reopen ${t.title}` : `Mark ${t.title} done`}
                    onPointerDown={(ev) => ev.stopPropagation()}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      run(() => setTaskDone(t.id, !doneTask));
                    }}
                    className="flex h-[11px] w-[11px] shrink-0 items-center justify-center rounded-[3px] border"
                    style={{
                      borderColor: doneTask ? "#5f9a4f" : "#bf6f1c",
                      background: doneTask ? "#5f9a4f" : "transparent",
                    }}
                  >
                    {doneTask ? (
                      <svg width="7" height="7" viewBox="0 0 8 8" aria-hidden="true">
                        <path d="M1 4.2 3 6l4-4.4" stroke="#fff" strokeWidth="1.6" fill="none" />
                      </svg>
                    ) : null}
                  </button>
                  <span
                    className={`truncate text-[10.5px] ${
                      doneTask ? "text-[color:var(--color-text-faint)] line-through" : "text-[color:var(--color-text)]"
                    }`}
                  >
                    {t.title}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
        {height >= 92 && b.description ? (
          <p className="mt-0.5 line-clamp-3 text-[10.5px] leading-snug text-[color:var(--color-text)]">
            {b.description}
          </p>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 h-[7px] cursor-ns-resize" aria-hidden="true" />
      </div>
    );
  }

  const byDay = useMemo(() => {
    const m = new Map<number, ScheduleBlock[]>();
    for (let d = 0; d < 7; d++) m.set(d, []);
    for (const b of blocks) {
      const day = drag && drag.kind === "move" && drag.id === b.id && drag.moved ? drag.day : b.day;
      m.get(day)?.push(b);
    }
    return m;
  }, [blocks, drag]);

  const hourMarks = useMemo(() => {
    const out: number[] = [];
    for (let m = Math.ceil(gridStart / 60) * 60; m <= gridEnd; m += 60) out.push(m);
    return out;
  }, [gridStart, gridEnd]);

  return (
    <div className="flex flex-col gap-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {BLOCK_TYPES.map((t) => (
          <span key={t.key} className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[color:var(--color-text)]">
            <span
              className="inline-block h-[9px] w-[9px] rounded-[2px]"
              style={{ background: typeColor(t.key, settings.colors) }}
              aria-hidden="true"
            />
            {t.label}
          </span>
        ))}
        <span className="ml-auto text-[12px] text-[color:var(--color-text-muted)]">
          Drag on the grid to add a block. Tap a block to edit it.
        </span>
      </div>
      {error ? (
        <p role="alert" className="text-[13px] text-[color:var(--color-state-error)]">{error}</p>
      ) : null}

      {/* The grid */}
      <div className="overflow-x-auto rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
        <div className="min-w-[860px]">
          {/* Day header */}
          <div className="sticky top-0 z-20 flex border-b border-[color:var(--border-hair)] bg-card">
            <div style={{ width: GUTTER }} className="shrink-0" />
            {DAY_LABELS.map((d, i) => (
              <div
                key={d}
                className={`flex-1 border-l border-[color:var(--border-hair)] py-2 text-center text-[12px] font-semibold uppercase tracking-[0.2em] ${
                  nowStamp?.day === i ? "text-amber-deep" : "text-bark"
                }`}
              >
                {d}
              </div>
            ))}
          </div>

          <div className="flex">
            {/* Time gutter */}
            <div style={{ width: GUTTER, height: gridHeight }} className="relative shrink-0">
              {hourMarks.map((m) => (
                <span
                  key={m}
                  className="absolute right-2 -translate-y-1/2 text-[10.5px] text-[color:var(--color-text-faint)]"
                  style={{ top: (m - gridStart) * PX_PER_MIN }}
                >
                  {formatMinutes(m, true)}
                </span>
              ))}
            </div>

            {/* Day columns */}
            <div ref={columnsRef} className="relative flex flex-1" style={{ height: gridHeight }}>
              {Array.from({ length: 7 }, (_, day) => (
                <div
                  key={day}
                  onPointerDown={onGridPointerDown}
                  className="relative flex-1 border-l border-[color:var(--border-hair)]"
                  style={{
                    backgroundImage:
                      "repeating-linear-gradient(to bottom, transparent 0px, transparent 55px, rgba(42,33,24,0.12) 55px, rgba(42,33,24,0.12) 56px), repeating-linear-gradient(to bottom, transparent 0px, transparent 27px, rgba(42,33,24,0.045) 27px, rgba(42,33,24,0.045) 28px)",
                  }}
                >
                  {layoutDay(byDay.get(day) ?? []).map(({ b, lane, lanes }) => renderBlock(b, lane, lanes))}
                  {/* Create draft */}
                  {drag?.kind === "create" && drag.draft.day === day ? (
                    <div
                      className="pointer-events-none absolute inset-x-[2px] z-20 rounded-md"
                      style={{
                        top: (drag.draft.start - gridStart) * PX_PER_MIN,
                        height: (drag.draft.end - drag.draft.start) * PX_PER_MIN,
                        border: "1.5px dashed #bf6f1c",
                        background: "rgba(217,138,58,.12)",
                      }}
                    >
                      <span className="px-1.5 text-[10.5px] font-semibold text-amber-deep">
                        {formatRange(drag.draft.start, drag.draft.end)}
                      </span>
                    </div>
                  ) : null}
                  {/* Now line */}
                  {nowStamp?.day === day && nowStamp.min >= gridStart && nowStamp.min <= gridEnd ? (
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-x-0 z-20"
                      style={{ top: (nowStamp.min - gridStart) * PX_PER_MIN, borderTop: "1.5px solid #bf6f1c" }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Editor modal */}
      {editor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            onClick={() => closeEditor(true)}
            className="absolute inset-0"
            style={{ background: "rgba(42,33,24,.4)" }}
          />
          <div
            role="dialog"
            aria-label={editor.title || "Edit block"}
            className="relative max-h-[90vh] w-[400px] max-w-full overflow-y-auto rounded-2xl bg-card p-5 shadow-[var(--shadow-card)]"
            onKeyDown={(ev) => {
              if (ev.key === "Escape") closeEditor(true);
              if (ev.key === "Enter" && (ev.target as HTMLElement).tagName !== "TEXTAREA") closeEditor(true);
            }}
          >
            <div className="flex items-start justify-between gap-2">
              <input
                autoFocus
                className="w-full border-b border-[color:var(--border-strong)] bg-transparent pb-1 font-[family-name:var(--font-display)] text-[22px] text-forest-deep outline-none focus:border-amber"
                value={editor.title}
                placeholder="Block title"
                onChange={(ev) => setEditor({ ...editor, title: ev.target.value })}
              />
              <button
                type="button"
                aria-label="Close"
                onClick={() => closeEditor(true)}
                className="-m-1 flex h-9 w-9 shrink-0 items-center justify-center text-[color:var(--color-text-muted)] hover:text-ink"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-3 flex flex-col gap-3">
              <input
                className="h-10 rounded-[10px] border border-[color:var(--border-strong)] bg-card px-3 text-[13.5px] text-ink outline-none focus:border-amber"
                placeholder="Location"
                value={editor.location}
                onChange={(ev) => setEditor({ ...editor, location: ev.target.value })}
              />
              <textarea
                rows={2}
                className="rounded-[10px] border border-[color:var(--border-strong)] bg-card p-3 text-[13.5px] text-ink outline-none focus:border-amber"
                placeholder="Description"
                value={editor.description}
                onChange={(ev) => setEditor({ ...editor, description: ev.target.value })}
              />

              {/* Block type */}
              <div className="flex flex-wrap gap-1.5">
                {BLOCK_TYPES.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setEditor({ ...editor, block_type: t.key })}
                    className={`rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors ${
                      editor.block_type === t.key
                        ? "border-transparent text-bone"
                        : "border-[color:var(--border-strong)] text-[color:var(--color-text)]"
                    }`}
                    style={editor.block_type === t.key ? { background: typeColor(t.key, settings.colors) } : undefined}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Days */}
              <div>
                <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">Days</span>
                <div className="flex gap-1.5">
                  {DAY_LABELS.map((d, i) => {
                    const on = editor.days.includes(i);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        aria-label={d}
                        onClick={() => {
                          const next = on ? editor.days.filter((x) => x !== i) : [...editor.days, i];
                          if (next.length === 0) return;
                          setEditor({ ...editor, days: next });
                        }}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg border text-[12px] font-bold transition-colors ${
                          on
                            ? "border-forest bg-forest text-bone"
                            : "border-[color:var(--border-strong)] bg-card text-[color:var(--color-text-muted)]"
                        }`}
                      >
                        {d[0]}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Repeats and times */}
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">
                  Repeats
                  <select
                    className="h-10 rounded-[10px] border border-[color:var(--border-strong)] bg-card px-2 text-[13px] font-normal normal-case tracking-normal text-ink"
                    value={editor.recur}
                    onChange={(ev) => setEditor({ ...editor, recur: ev.target.value })}
                  >
                    {RECURS.map((r) => (
                      <option key={r.key} value={r.key}>{r.label}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">
                  Start
                  <select
                    className="h-10 rounded-[10px] border border-[color:var(--border-strong)] bg-card px-2 text-[13px] font-normal normal-case tracking-normal text-ink"
                    value={editor.start_min}
                    onChange={(ev) => {
                      const s = Number(ev.target.value);
                      setEditor({ ...editor, start_min: s, end_min: Math.max(editor.end_min, s + SNAP) });
                    }}
                  >
                    {timeOptions.slice(0, -1).map((m) => (
                      <option key={m} value={m}>{formatMinutes(m, true)}</option>
                    ))}
                  </select>
                </label>
                <label className="flex flex-col gap-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">
                  End
                  <select
                    className="h-10 rounded-[10px] border border-[color:var(--border-strong)] bg-card px-2 text-[13px] font-normal normal-case tracking-normal text-ink"
                    value={editor.end_min}
                    onChange={(ev) => setEditor({ ...editor, end_min: Number(ev.target.value) })}
                  >
                    {timeOptions.filter((m) => m > editor.start_min).map((m) => (
                      <option key={m} value={m}>{formatMinutes(m, true)}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* Fill this block: Work blocks only */}
              {editor.block_type === "admin" && editorBlock ? (
                <div>
                  <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">
                    Fill this block
                    <span className="ml-1 font-normal normal-case tracking-normal text-[color:var(--color-text-faint)]">
                      · {editorLinks.length} linked to {DAY_LABELS[editorBlock.day]} only
                    </span>
                  </span>
                  {fillList.length === 0 ? (
                    <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
                      Nothing open on the task board. Add tasks on /tasks and fill this block from here.
                    </p>
                  ) : (
                    <ul className="max-h-52 overflow-y-auto rounded-[10px] border border-[color:var(--border-hair)]">
                      {fillList.map((t) => {
                        const here = editorLinkedIds.has(t.id);
                        const elsewhereBlockId = !here ? taskWeekHome.get(t.id) : undefined;
                        const elsewhere = elsewhereBlockId ? blockById.get(elsewhereBlockId) : undefined;
                        return (
                          <li key={t.id}>
                            <button
                              type="button"
                              disabled={pending}
                              onClick={() => toggleFill(t.id)}
                              className={`flex w-full items-center gap-2 border-b border-[color:var(--border-hair)] px-2.5 py-1.5 text-left last:border-b-0 ${
                                here ? "border-l-2 border-l-amber bg-amber/10" : elsewhere ? "bg-inset" : "hover:bg-inset"
                              }`}
                            >
                              {t.pin_today ? (
                                <span className="shrink-0 rounded-full bg-amber px-1.5 py-px text-[9.5px] font-bold text-[#23170c]">Pinned</span>
                              ) : (
                                <span
                                  className="shrink-0 rounded-full px-1.5 py-px text-[9.5px] font-bold capitalize text-white"
                                  style={{ background: PRIORITY_PILL[t.priority] ?? "#6b4a2e" }}
                                >
                                  {t.priority}
                                </span>
                              )}
                              <span className={`min-w-0 flex-1 truncate text-[12.5px] ${elsewhere ? "text-[color:var(--color-text-muted)]" : "text-ink"}`}>
                                {t.title}
                              </span>
                              {here ? (
                                <span className="text-[11px] font-bold text-amber-deep">✓</span>
                              ) : elsewhere ? (
                                <span className="shrink-0 text-[10.5px] text-[color:var(--color-text-faint)]">
                                  On {DAY_LABELS[elsewhere.day]}, tap to move
                                </span>
                              ) : t.due_date ? (
                                <span className="shrink-0 text-[10.5px] text-[color:var(--color-text-faint)]">
                                  due {new Date(t.due_date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ) : null}

              <div className="mt-1 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    if (!editor.confirmDelete) {
                      setEditor({ ...editor, confirmDelete: true });
                      return;
                    }
                    const grp = editor.grp;
                    setEditor(null);
                    run(() => deleteGroup(grp));
                  }}
                  className="text-[13px] font-semibold text-[color:var(--color-state-error)] max-md:min-h-[44px]"
                >
                  {editor.confirmDelete ? "Delete every day of this block?" : "Delete"}
                </button>
                <button
                  type="button"
                  onClick={() => closeEditor(true)}
                  disabled={pending}
                  className="rounded-full bg-amber px-5 py-2 text-[13.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70 max-md:min-h-[44px]"
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Travel suggestion */}
      {toast ? (
        <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full bg-chrome px-5 py-2.5 text-[13px] text-bone shadow-[var(--shadow-card)]">
          <span>Add {toast.end - toast.start} min travel after this session?</span>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const t = toast;
              setToast(null);
              run(() =>
                createBlock({
                  day: t.day,
                  start_min: t.start,
                  end_min: t.end,
                  title: "Travel",
                  block_type: "travel",
                }).then((r) => ({ error: r.error })),
              );
            }}
            className="rounded-full bg-amber px-3.5 py-1 text-[12.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep"
          >
            Add travel
          </button>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-[12.5px] font-medium text-bone/70 transition-colors hover:text-bone"
          >
            Not now
          </button>
        </div>
      ) : null}
    </div>
  );
}
