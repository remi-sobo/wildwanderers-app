"use client";

// Advisor access on /settings (owner only, specs/advisor.md): invite a
// business advisor, remove or restore their access, and choose what they
// see. The database enforces the boundary; this card only sets it.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Handshake, Plus } from "lucide-react";
import { inviteAdvisor, setAdvisorActive, setAdvisorShare } from "@/lib/advisor/owner-actions";
import type { AdvisorAccess } from "@/lib/data/advisor-owner";

const field =
  "h-11 md:h-10 rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[16px] md:text-[14px] text-ink";

export function AdvisorAccessCard({ access }: { access: AdvisorAccess }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [invite, setInvite] = useState({ name: "", email: "" });

  function run(fn: () => Promise<{ error: string | null }>, done?: string, after?: () => void) {
    setError(null);
    setNote(null);
    start(async () => {
      let res: { error: string | null };
      try {
        res = await fn();
      } catch {
        res = { error: "Check your connection and try again." };
      }
      if (res.error) {
        setError(res.error);
        return;
      }
      if (done) setNote(done);
      after?.();
      router.refresh();
    });
  }

  const tasksShared = access.shares.tasks ?? false;

  return (
    <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3 border-b border-[color:var(--border-hair)] px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-inset text-forest">
          <Handshake size={17} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-[17px] text-forest-deep">Advisor access</h2>
          <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
            A business advisor sees only what you share here. Never clients, families, kids, messages or
            finance detail.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-5 p-5">
        {access.advisors.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {access.advisors.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-[14.5px] font-semibold text-forest-deep">{a.advisor_name || "Advisor"}</p>
                  <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
                    {a.active ? "Has access" : "Access removed"}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => run(() => setAdvisorActive(a.id, !a.active), a.active ? "Access removed." : "Access restored.")}
                  className="inline-flex min-h-[44px] items-center rounded-full border border-[color:var(--border-strong)] px-4 text-[13px] font-semibold text-forest-deep disabled:opacity-60 md:min-h-[36px]"
                >
                  {a.active ? "Remove access" : "Restore access"}
                </button>
              </li>
            ))}
          </ul>
        ) : null}

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">What they see</p>
          <label className="mt-2 flex items-start gap-3">
            <input
              type="checkbox"
              checked={tasksShared}
              disabled={pending}
              onChange={(e) => run(() => setAdvisorShare("tasks", e.target.checked), "Saved.")}
              className="mt-1 h-5 w-5 accent-[#2e4a33]"
            />
            <span>
              <span className="block text-[14px] text-forest-deep">Tasks you share</span>
              <span className="block text-[12.5px] text-[color:var(--color-text-muted)]">
                Only tasks you mark "Share with your advisor". A task linked to a client, lead or family
                shows to them only as a client task, with no details. They always see the tasks they
                send you.
              </span>
            </span>
          </label>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            run(() => inviteAdvisor(invite), "Invited. They set a password from Forgot password on the sign-in page.", () =>
              setInvite({ name: "", email: "" }),
            );
          }}
          className="flex flex-col gap-2"
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">Invite an advisor</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              className={`${field} sm:flex-1`}
              placeholder="Name"
              aria-label="Advisor name"
              value={invite.name}
              onChange={(e) => setInvite({ ...invite, name: e.target.value })}
            />
            <input
              className={`${field} sm:flex-1`}
              placeholder="Email"
              type="email"
              aria-label="Advisor email"
              value={invite.email}
              onChange={(e) => setInvite({ ...invite, email: e.target.value })}
            />
            <button
              type="submit"
              disabled={pending || !invite.name.trim() || !invite.email.trim()}
              className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-full bg-amber px-4 text-[14px] font-semibold text-[#23170c] disabled:opacity-60 md:min-h-[40px]"
            >
              <Plus size={15} aria-hidden="true" /> Invite
            </button>
          </div>
        </form>

        {error ? (
          <p role="alert" className="text-[13px] text-[color:var(--color-state-error)]">
            {error}
          </p>
        ) : null}
        {note ? <p className="text-[13px] text-fern">{note}</p> : null}
      </div>
    </section>
  );
}
