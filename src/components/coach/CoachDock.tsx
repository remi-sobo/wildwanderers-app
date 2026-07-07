"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, ClipboardList, Dumbbell, Send, Flag } from "lucide-react";
import { summarizeClient, draftWorkoutPlan } from "@/lib/ai/coach-actions";
import { ReportIssueSheet } from "@/components/report/ReportIssueSheet";

export type CoachClient = { id: string; name: string };

// Coach's home on the coach shell: a floating amber button that opens a right
// drawer. Coach is Gabe's tool, so it never renders on the client surfaces.
// Commit 2 wires "summarize a client" end to end; drafting lands next.
export function CoachDock({ clients, configured }: { clients: CoachClient[]; configured: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [ask, setAsk] = useState("");
  const [drafting, startDraft] = useTransition();
  const [draftError, setDraftError] = useState<string | null>(null);

  // Outside tap and Escape close the FAB menu.
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function resetOutputs() {
    setAnswer(null);
    setError(null);
    setDraftError(null);
  }

  function runSummary() {
    if (!clientId) return;
    setError(null);
    setAnswer(null);
    startTransition(async () => {
      const res = await summarizeClient(clientId);
      if (res.error) setError(res.error);
      else setAnswer(res.text);
    });
  }

  function runDraft() {
    if (!clientId || !ask.trim()) return;
    setDraftError(null);
    startDraft(async () => {
      const res = await draftWorkoutPlan(clientId, ask);
      if (res.error || !res.planId) {
        setDraftError(res.error ?? "Scout could not draft that.");
        return;
      }
      // The draft is saved as a resting plan; open it in the builder for
      // Gabe to review, edit, and approve.
      setOpen(false);
      router.push(`/program/clients/${clientId}/plan/new?draft=${res.planId}`);
    });
  }

  return (
    <>
      {/* FAB + its action menu */}
      <div
        ref={menuRef}
        className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-2.5 md:bottom-8 md:right-8"
      >
        {menuOpen ? (
          <div className="flex flex-col gap-1 rounded-2xl border border-[color:var(--border-hair)] bg-canvas p-1.5 shadow-[0_16px_44px_rgba(42,33,24,0.28)]">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setOpen(true);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-[13.5px] font-semibold text-ink transition-colors hover:bg-amber/10"
            >
              <Sparkles size={16} className="text-forest" aria-hidden="true" />
              Ask Scout
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setReportOpen(true);
              }}
              className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-[13.5px] font-semibold text-ink transition-colors hover:bg-amber/10"
            >
              <Flag size={16} className="text-forest" aria-hidden="true" />
              Report an issue
            </button>
          </div>
        ) : null}

        <button
          type="button"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Quick actions"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-amber text-[#23170c] shadow-[0_12px_30px_rgba(120,68,16,0.34)] transition-transform hover:-translate-y-0.5 hover:bg-amber-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber"
        >
          <Sparkles
            size={22}
            strokeWidth={1.9}
            aria-hidden="true"
            className={`transition-transform ${menuOpen ? "rotate-45" : ""}`}
          />
        </button>
      </div>

      <ReportIssueSheet open={reportOpen} onClose={() => setReportOpen(false)} />

      {/* Drawer */}
      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close Coach"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-[#1e1a12]/40"
          />
          <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-canvas shadow-[-8px_0_40px_rgba(42,33,24,0.18)]">
            {/* Header */}
            <div className="relative overflow-hidden bg-chrome px-6 pb-6 pt-6">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-bone/10 text-bone">
                    <Sparkles size={19} strokeWidth={1.9} aria-hidden="true" />
                  </span>
                  <div>
                    <h2 className="font-[family-name:var(--font-display)] text-[20px] leading-none text-bone">
                      Scout
                    </h2>
                    <p className="mt-1 text-[12.5px] text-bone/65">
                      Your assistant. Drafts and summaries, always your call.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="text-bone/70 transition-colors hover:text-bone"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {!configured ? (
                <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 text-[13.5px] leading-[1.55] text-[color:var(--color-text-muted)] shadow-[var(--shadow-card)]">
                  Scout is not switched on yet. Once the API key is set in the
                  deployment, Scout can summarize a client and draft workouts for
                  you to review. Everything it drafts stays a draft until you
                  approve it.
                </div>
              ) : null}

              {clients.length === 0 ? (
                <p className="text-[13.5px] text-[color:var(--color-text-muted)]">
                  Add a client first, then Scout can summarize them or draft a
                  workout.
                </p>
              ) : (
                <>
                  {/* Shared client picker */}
                  <label className="mb-5 block">
                    <span className="mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-bark">
                      Client
                    </span>
                    <select
                      value={clientId}
                      onChange={(e) => {
                        setClientId(e.target.value);
                        resetOutputs();
                      }}
                      className="h-11 w-full rounded-xl border border-[color:var(--border-strong)] bg-card px-3 text-[14.5px] text-ink"
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  {/* Summarize */}
                  <section className="border-t border-[color:var(--border-hair)] pt-5">
                    <div className="mb-2 flex items-center gap-2">
                      <ClipboardList size={15} className="text-forest" aria-hidden="true" />
                      <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-bark">
                        Summarize
                      </h3>
                    </div>
                    <p className="mb-3 text-[13px] text-[color:var(--color-text-muted)]">
                      A fast read on where they are, from their training and
                      wellness. A progress read, never a medical assessment.
                    </p>
                    <button
                      type="button"
                      onClick={runSummary}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-full bg-forest px-4 py-2 text-[13.5px] font-semibold text-bone transition-colors hover:bg-forest-deep disabled:opacity-70"
                    >
                      {pending ? "Reading" : "Summarize this client"}
                      {!pending ? <Send size={14} aria-hidden="true" /> : null}
                    </button>
                    {error ? (
                      <p role="alert" className="mt-3 text-[13px] text-[color:var(--color-state-error)]">
                        {error}
                      </p>
                    ) : null}
                    {answer ? (
                      <div className="mt-4 rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
                        <p className="whitespace-pre-wrap text-[14.5px] leading-[1.6] text-[color:var(--color-text)]">
                          {answer}
                        </p>
                        <p className="mt-3 text-[11.5px] text-[color:var(--color-text-faint)]">
                          For you, not the client. A progress read, not a medical
                          assessment.
                        </p>
                      </div>
                    ) : null}
                  </section>

                  {/* Draft a workout */}
                  <section className="mt-6 border-t border-[color:var(--border-hair)] pt-5">
                    <div className="mb-2 flex items-center gap-2">
                      <Dumbbell size={15} className="text-forest" aria-hidden="true" />
                      <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-bark">
                        Draft a workout
                      </h3>
                    </div>
                    <p className="mb-3 text-[13px] text-[color:var(--color-text-muted)]">
                      Scout drafts a plan from the exercise library. It opens in
                      the plan builder for you to review, edit, and activate.
                      Nothing goes live until you approve it.
                    </p>
                    <textarea
                      value={ask}
                      onChange={(e) => setAsk(e.target.value)}
                      rows={3}
                      placeholder="What should Coach draft? e.g. a 3-day full-body week for a beginner, or add a mobility day to their plan."
                      className="w-full rounded-xl border border-[color:var(--border-strong)] bg-card p-3 text-[14px] text-ink"
                    />
                    <button
                      type="button"
                      onClick={runDraft}
                      disabled={drafting || !ask.trim()}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70"
                    >
                      {drafting ? "Drafting" : "Draft with Scout"}
                      {!drafting ? <Sparkles size={14} aria-hidden="true" /> : null}
                    </button>
                    {draftError ? (
                      <p role="alert" className="mt-3 text-[13px] text-[color:var(--color-state-error)]">
                        {draftError}
                      </p>
                    ) : null}
                  </section>
                </>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
