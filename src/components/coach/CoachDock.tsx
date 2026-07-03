"use client";

import { useState, useTransition } from "react";
import { Sparkles, X, ClipboardList, Send } from "lucide-react";
import { summarizeClient } from "@/lib/ai/coach-actions";

export type CoachClient = { id: string; name: string };

// Coach's home on the coach shell: a floating amber button that opens a right
// drawer. Coach is Gabe's tool, so it never renders on the client surfaces.
// Commit 2 wires "summarize a client" end to end; drafting lands next.
export function CoachDock({ clients, configured }: { clients: CoachClient[]; configured: boolean }) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  return (
    <>
      {/* FAB */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Coach"
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-amber text-[#23170c] shadow-[0_12px_30px_rgba(120,68,16,0.34)] transition-transform hover:-translate-y-0.5 hover:bg-amber-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber md:bottom-8 md:right-8"
      >
        <Sparkles size={22} strokeWidth={1.9} aria-hidden="true" />
      </button>

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
                      Coach
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
                  Coach is not switched on yet. Once the API key is set in the
                  deployment, Coach can summarize a client and draft workouts for
                  you to review. Everything it drafts stays a draft until you
                  approve it.
                </div>
              ) : null}

              <section className="mt-1">
                <div className="mb-2 flex items-center gap-2">
                  <ClipboardList size={15} className="text-forest" aria-hidden="true" />
                  <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-bark">
                    Summarize a client
                  </h3>
                </div>
                <p className="mb-3 text-[13px] text-[color:var(--color-text-muted)]">
                  A fast read on where a client is, from their training and
                  wellness. It is a progress read, never a medical assessment.
                </p>

                {clients.length === 0 ? (
                  <p className="text-[13.5px] text-[color:var(--color-text-muted)]">
                    Add a client first, then Coach can summarize them.
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <select
                      value={clientId}
                      onChange={(e) => {
                        setClientId(e.target.value);
                        setAnswer(null);
                        setError(null);
                      }}
                      className="h-11 flex-1 rounded-xl border border-[color:var(--border-strong)] bg-card px-3 text-[14.5px] text-ink"
                    >
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={runSummary}
                      disabled={pending}
                      className="flex shrink-0 items-center gap-1.5 rounded-xl bg-amber px-4 text-[14px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70"
                    >
                      {pending ? "Reading" : "Summarize"}
                      {!pending ? <Send size={15} aria-hidden="true" /> : null}
                    </button>
                  </div>
                )}

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
                      Drafted by Coach for you, not the client. A progress read,
                      not a medical assessment.
                    </p>
                  </div>
                ) : null}
              </section>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
