"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, RotateCcw, Trash2, Archive } from "lucide-react";
import {
  reorderMovements,
  setMovementActive,
  deleteMovement,
} from "@/lib/exercises/actions";
import { VideoBadge } from "@/components/ui/VideoEmbed";
import type { ManagedMovement } from "@/lib/data/exercises";

const KIND_LABEL: Record<string, string> = {
  strength: "Strength",
  cardio: "Cardio",
  mobility: "Mobility",
  warmup: "Warm-up",
  cooldown: "Cool-down",
  skill: "Skill",
};

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-inset px-2.5 py-0.5 text-[11.5px] font-semibold text-[color:var(--color-text-muted)]">
      {children}
    </span>
  );
}

export function MovementsList({ movements }: { movements: ManagedMovement[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const initialActive = useMemo(() => movements.filter((m) => m.is_active), [movements]);
  const retired = useMemo(() => movements.filter((m) => !m.is_active), [movements]);

  // Local order for the active list so up/down feels instant; a Save button
  // commits it once, rather than a write per nudge.
  const [order, setOrder] = useState<ManagedMovement[]>(initialActive);
  const dirty = order.map((m) => m.id).join(",") !== initialActive.map((m) => m.id).join(",");

  // Resync when the server data changes (after a retire, delete, or saved
  // reorder refreshes the page). initialActive gets a fresh reference only on a
  // re-fetch, so a local up/down nudge does not trip this.
  useEffect(() => {
    setOrder(initialActive);
  }, [initialActive]);

  function move(index: number, dir: -1 | 1) {
    const next = [...order];
    const target = index + dir;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setOrder(next);
  }

  function saveOrder() {
    setError(null);
    start(async () => {
      const res = await reorderMovements(order.map((m) => m.id));
      if (!res.ok) setError(res.error ?? "Could not save the order.");
      else router.refresh();
    });
  }

  function retireOrRestore(id: string, active: boolean) {
    setError(null);
    setBusyId(id);
    start(async () => {
      const res = await setMovementActive(id, active);
      setBusyId(null);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  function remove(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    setError(null);
    setBusyId(id);
    start(async () => {
      const res = await deleteMovement(id);
      setBusyId(null);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });
  }

  const rowClass =
    "flex items-center gap-3 rounded-xl border border-[color:var(--border-hair)] bg-card px-4 py-3";

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p
          role="alert"
          className="rounded-xl border border-[color:var(--color-state-error)]/30 bg-[color:var(--color-state-error)]/8 px-4 py-3 text-[13.5px] text-[color:var(--color-state-error)]"
        >
          {error}
        </p>
      ) : null}

      {dirty ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-inset/70 px-4 py-3">
          <p className="text-[13px] text-[color:var(--color-text-muted)]">
            You changed the order.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOrder(initialActive)}
              className="rounded-full px-4 py-1.5 text-[13px] font-semibold text-forest hover:bg-forest/5 max-md:min-h-[44px]"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={saveOrder}
              disabled={pending}
              className="rounded-full bg-forest px-4 py-1.5 text-[13px] font-semibold text-bone hover:bg-forest-deep disabled:opacity-60 max-md:min-h-[44px]"
            >
              {pending ? "Saving" : "Save order"}
            </button>
          </div>
        </div>
      ) : null}

      {/* Active movements */}
      <ul className="flex flex-col gap-2">
        {order.map((m, i) => (
          <li key={m.id} className={rowClass}>
            <div className="flex flex-col max-md:-my-2 max-md:gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0 || pending}
                aria-label="Move up"
                className="flex items-center justify-center rounded-md text-[color:var(--color-text-faint)] transition-colors hover:text-forest disabled:opacity-30 max-md:h-10 max-md:w-10 max-md:-mx-2"
              >
                <ArrowUp size={15} />
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1 || pending}
                aria-label="Move down"
                className="flex items-center justify-center rounded-md text-[color:var(--color-text-faint)] transition-colors hover:text-forest disabled:opacity-30 max-md:h-10 max-md:w-10 max-md:-mx-2"
              >
                <ArrowDown size={15} />
              </button>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-[family-name:var(--font-display)] text-[15.5px] text-ink">
                  {m.title}
                </span>
                <Badge>{KIND_LABEL[m.kind] ?? m.kind}</Badge>
                {m.muscle_group ? (
                  <span className="text-[12.5px] text-[color:var(--color-text-muted)]">
                    {m.muscle_group}
                  </span>
                ) : null}
                <VideoBadge url={m.media_url} />
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Link
                href={`/fitness/movements/${m.id}/edit`}
                aria-label={`Edit ${m.title}`}
                className="flex items-center justify-center rounded-lg p-2 text-[color:var(--color-text-muted)] transition-colors hover:bg-inset hover:text-forest max-md:h-11 max-md:w-11 max-md:p-0"
              >
                <Pencil size={15} />
              </Link>
              <button
                type="button"
                onClick={() => retireOrRestore(m.id, false)}
                disabled={busyId === m.id}
                aria-label={`Retire ${m.title}`}
                title="Retire (hide from plans and clients)"
                className="flex items-center justify-center rounded-lg p-2 text-[color:var(--color-text-muted)] transition-colors hover:bg-inset hover:text-bark disabled:opacity-40 max-md:h-11 max-md:w-11 max-md:p-0"
              >
                <Archive size={15} />
              </button>
              {m.usage_count === 0 ? (
                <button
                  type="button"
                  onClick={() => remove(m.id, m.title)}
                  disabled={busyId === m.id}
                  aria-label={`Delete ${m.title}`}
                  className="flex items-center justify-center rounded-lg p-2 text-[color:var(--color-text-muted)] transition-colors hover:bg-[color:var(--color-state-error)]/10 hover:text-[color:var(--color-state-error)] disabled:opacity-40 max-md:h-11 max-md:w-11 max-md:p-0"
                >
                  <Trash2 size={15} />
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {order.length === 0 ? (
        <p className="rounded-xl bg-inset/60 px-4 py-6 text-center text-[13.5px] text-[color:var(--color-text-muted)]">
          No active movements yet. Add one to start building plans from it.
        </p>
      ) : null}

      {/* Retired movements */}
      {retired.length > 0 ? (
        <div>
          <p className="eyebrow mb-2 text-bark">Retired</p>
          <ul className="flex flex-col gap-2">
            {retired.map((m) => (
              <li key={m.id} className={`${rowClass} opacity-70`}>
                <div className="min-w-0 flex-1">
                  <span className="font-[family-name:var(--font-display)] text-[15px] text-[color:var(--color-text-muted)]">
                    {m.title}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => retireOrRestore(m.id, true)}
                  disabled={busyId === m.id}
                  className="inline-flex items-center gap-1.5 rounded-full border border-forest/30 px-3 py-1.5 text-[12.5px] font-semibold text-forest transition-colors hover:bg-forest/5 disabled:opacity-40 max-md:min-h-[44px]"
                >
                  <RotateCcw size={13} /> Restore
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
