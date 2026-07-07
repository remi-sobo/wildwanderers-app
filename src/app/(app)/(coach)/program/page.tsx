import Link from "next/link";
import { ChevronRight, Inbox, LayoutTemplate, Plus } from "lucide-react";
import { getClients, clientName, type ClientStatus } from "@/lib/data/clients";
import { getDraftsAcrossClients } from "@/lib/data/plans";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { getPublishingCadence } from "@/lib/data/library";
import { EmptyState } from "@/components/ui/EmptyState";
import { LibraryNudgeStrip } from "@/components/library/LibraryNudgeStrip";

const STATUS_STYLE: Record<ClientStatus, string> = {
  active: "bg-[color:var(--color-state-good)]/12 text-[color:var(--color-state-good)]",
  paused: "bg-[color:var(--color-state-caution)]/15 text-[color:var(--color-state-caution)]",
  archived: "bg-inset text-[color:var(--color-text-muted)]",
};

function StatusPill({ status }: { status: ClientStatus }) {
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${STATUS_STYLE[status]}`}
    >
      {status}
    </span>
  );
}

export default async function ProgramPage() {
  const [clients, session, drafts] = await Promise.all([
    getClients(),
    getSessionProfile(),
    getDraftsAcrossClients(),
  ]);
  const waitingCount = drafts.filter((d) => d.initiated_by === "client").length;
  const draftCount = drafts.length;
  // The library nudge is Gabe's, owner only. A coach cannot publish, so they
  // never see it. Fetched only for the owner to keep the read off the coach path.
  const cadence = session?.profile?.role === "owner" ? await getPublishingCadence() : null;

  return (
    <div className="flex flex-col gap-5">
      {cadence ? <LibraryNudgeStrip cadence={cadence} /> : null}
      <div className="flex items-center justify-between">
        <p className="text-[13px] text-[color:var(--color-text-muted)]">
          {clients.length === 0
            ? "No clients yet"
            : `${clients.length} ${clients.length === 1 ? "client" : "clients"}`}
        </p>
        <div className="flex items-center gap-2">
          <Link
            href="/program/drafts"
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-[13.5px] font-semibold text-forest transition-colors hover:bg-inset"
          >
            <Inbox size={15} aria-hidden="true" />
            Drafts
            {draftCount > 0 ? (
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10.5px] font-bold leading-none ${
                  waitingCount > 0 ? "bg-amber text-[#23170c]" : "bg-inset text-bark"
                }`}
              >
                {draftCount}
              </span>
            ) : null}
          </Link>
          <Link
            href="/program/templates"
            className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-[13.5px] font-semibold text-forest transition-colors hover:bg-inset"
          >
            <LayoutTemplate size={15} aria-hidden="true" />
            Templates
          </Link>
          <Link
            href="/program/clients/new"
            className="inline-flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] shadow-[0_8px_20px_rgba(120,68,16,.22)] transition-colors hover:bg-amber-deep"
          >
            <Plus size={16} strokeWidth={2.2} aria-hidden="true" />
            Add client
          </Link>
        </div>
      </div>

      {clients.length === 0 ? (
        <EmptyState title="Your clients gather here.">
          Add your first client and their training plans, workouts, and progress
          show up in Program.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {clients.map((c) => (
            <li key={c.id}>
              <Link
                href={`/program/clients/${c.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-[color:var(--border-hair)] bg-card px-5 py-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[color:var(--border-strong)]"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-inset font-[family-name:var(--font-display)] text-[15px] text-forest">
                  {(c.first_name[0] ?? "") + (c.last_name[0] ?? "")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2.5">
                    <p className="truncate font-[family-name:var(--font-display)] text-[17px] text-forest-deep">
                      {clientName(c)}
                    </p>
                    <StatusPill status={c.status} />
                  </div>
                  <p className="truncate text-[13px] text-[color:var(--color-text-muted)]">
                    {c.active_plan_title
                      ? c.active_plan_title
                      : c.goal || "No active plan yet"}
                  </p>
                </div>
                <ChevronRight
                  size={18}
                  aria-hidden="true"
                  className="shrink-0 text-[color:var(--color-text-faint)] transition-transform group-hover:translate-x-0.5"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
