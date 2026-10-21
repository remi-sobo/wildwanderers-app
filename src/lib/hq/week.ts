// Pure pieces of Week (specs/week.md): suggesting a five from real
// tasks, what carries from yesterday and last week, and the order tasks
// are offered when picking the three. No server imports; unit tested.

type WeekTask = {
  id: string;
  status: string;
  kind?: string;
  pin_today: boolean;
  due_date: string | null;
  priority: string;
  assigned_by?: string | null;
};

const isOpen = (t: WeekTask) => (t.status === "open" || t.status === "in_progress") && t.kind !== "suggestion";

/** yyyy-mm-dd plus n days, in calendar terms (no timezone drift). */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

const PRIORITY: Record<string, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

/**
 * A starting five the owner edits, never a decision made for them: what
 * is overdue or pinned first, then work an advisor assigned, then what
 * is due this week by date, then high-priority undated work.
 */
export function suggestFive<T extends WeekTask>(tasks: T[], todayKey: string, weekStartKey: string): T[] {
  const weekEnd = addDays(weekStartKey, 6);
  const rank = (t: T): number => {
    const due = t.due_date?.slice(0, 10) ?? null;
    if (due && due < todayKey) return 0;
    if (t.pin_today) return 1;
    if (t.kind === "assignment") return 2;
    if (due && due <= weekEnd) return 3;
    if (!due && (t.priority === "urgent" || t.priority === "high")) return 4;
    return 9;
  };
  return tasks
    .filter(isOpen)
    .map((t) => ({ t, r: rank(t) }))
    .filter(({ r }) => r < 9)
    .sort(
      (a, b) =>
        a.r - b.r ||
        (a.t.due_date ?? "9999").localeCompare(b.t.due_date ?? "9999") ||
        (PRIORITY[a.t.priority] ?? 2) - (PRIORITY[b.t.priority] ?? 2),
    )
    .slice(0, 5)
    .map(({ t }) => t);
}

/** Picks from before that are still open and not already picked again. */
export function stillOpen<T extends WeekTask>(previousIds: string[], tasks: T[], currentIds: string[]): T[] {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const current = new Set(currentIds);
  return previousIds
    .map((id) => byId.get(id))
    .filter((t): t is T => Boolean(t) && isOpen(t!) && !current.has(t!.id));
}

/** The order tasks are offered when picking today's three. */
export function focusCandidates<T extends WeekTask>(tasks: T[], todayKey: string, fiveIds: string[]): T[] {
  const five = new Map(fiveIds.map((id, i) => [id, i]));
  const rank = (t: T): number => {
    if (five.has(t.id)) return 0;
    if (t.pin_today) return 1;
    const due = t.due_date?.slice(0, 10) ?? null;
    if (due && due <= todayKey) return 2;
    if (due) return 3;
    return 4;
  };
  return tasks
    .filter(isOpen)
    .sort(
      (a, b) =>
        rank(a) - rank(b) ||
        (five.get(a.id) ?? 0) - (five.get(b.id) ?? 0) ||
        (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"),
    );
}

/** Toggle a task in a capped pick list; returns null when full. */
export function togglePick(ids: string[], id: string, cap: number): string[] | null {
  if (ids.includes(id)) return ids.filter((x) => x !== id);
  if (ids.length >= cap) return null;
  return [...ids, id];
}
