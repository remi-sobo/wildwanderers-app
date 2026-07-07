"use client";

// The guided "Report an issue" drawer, forked in process from the Trellis
// ReportIssueSheet and rebuilt in the Wild Wanderers design system. A staff
// member picks what they are reporting (bug / confusing / idea), describes it
// (typing, optionally with a screenshot), and the intake guide runs a short
// interview that synthesizes a precise engineering brief. The report is filed
// and emailed to the build team. The owner additionally gets the paste-ready
// brief with a copy button, everyone else gets a warm confirmation.
//
// Phases: describe -> chat -> sending -> done (with an error surface throughout).

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Bug, HelpCircle, Lightbulb, X, Camera, Send, Check, Copy } from "lucide-react";
import { interviewIssue, fileIssueReport } from "@/lib/report/actions";

type Kind = "bug" | "confusing" | "idea";
type Phase = "describe" | "chat" | "sending" | "done";
interface Turn {
  role: "user" | "assistant";
  content: string;
}
interface Photo {
  data: string;
  mime: string;
  preview: string;
}

const KINDS: { key: Kind; icon: typeof Bug; label: string }[] = [
  { key: "bug", icon: Bug, label: "Something broke" },
  { key: "confusing", icon: HelpCircle, label: "Confusing" },
  { key: "idea", icon: Lightbulb, label: "An idea" },
];

const PLACEHOLDER: Record<Kind, string> = {
  bug: "What went wrong? What did you expect to happen instead?",
  confusing: "What confused you, or where did you get stuck?",
  idea: "What would you like the app to do? What is the goal?",
};

export function ReportIssueSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("describe");
  const [kind, setKind] = useState<Kind>("bug");
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [brief, setBrief] = useState<{ title: string; prompt: string } | null>(null);
  const [operator, setOperator] = useState(false);
  const [copied, setCopied] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reset everything each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    setPhase("describe");
    setKind("bug");
    setDraft("");
    setPhoto(null);
    setTurns([]);
    setBusy(false);
    setError("");
    setBrief(null);
    setOperator(false);
    setCopied(false);
  }, [open]);

  // Keep the transcript scrolled to the newest turn.
  useEffect(() => {
    if (phase === "chat" && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, phase, busy]);

  function pageContext() {
    return {
      path: pathname || (typeof window !== "undefined" ? window.location.pathname : undefined),
      title: typeof document !== "undefined" ? document.title : undefined,
    };
  }

  function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setPhoto({ data: dataUrl, mime: file.type, preview: dataUrl });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  // One interview turn against the guide. `next` is the full transcript to send.
  async function runInterview(next: Turn[]) {
    setBusy(true);
    setError("");
    try {
      const res = await interviewIssue({
        turns: next,
        kind,
        hasPhoto: !!photo,
        pageContext: pageContext(),
      });
      if (res.action === null) {
        setError(res.error);
        return;
      }
      if (res.action === "ready") {
        setBrief({ title: res.title, prompt: res.prompt });
        await file(next, res.title, res.prompt);
      } else {
        setTurns([...next, { role: "assistant", content: res.message }]);
      }
    } catch {
      setError("Could not reach the guide. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  async function file(finalTurns: Turn[], title: string, prompt: string) {
    setPhase("sending");
    setError("");
    try {
      const res = await fileIssueReport({
        kind,
        title,
        description: prompt,
        transcript: finalTurns,
        pagePath: pageContext().path,
        screenshot: photo ? { data: photo.data, mime: photo.mime } : undefined,
      });
      if (!res.ok) {
        setError(res.error);
        setPhase("chat");
        return;
      }
      setOperator(res.operator);
      setPhase("done");
    } catch {
      setError("Could not file your report. Try again.");
      setPhase("chat");
    }
  }

  function startInterview() {
    const text = draft.trim();
    if (!text || busy) return;
    const first: Turn[] = [{ role: "user", content: text }];
    setTurns(first);
    setPhase("chat");
    setDraft("");
    runInterview(first);
  }

  function answer() {
    const text = draft.trim();
    if (!text || busy) return;
    const next: Turn[] = [...turns, { role: "user", content: text }];
    setTurns(next);
    setDraft("");
    runInterview(next);
  }

  async function copyBrief() {
    if (!brief) return;
    try {
      await navigator.clipboard.writeText(brief.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard blocked
    }
  }

  if (!open) return null;

  const label = "mb-1.5 block text-[12px] font-semibold uppercase tracking-[0.12em] text-bark";
  const textarea =
    "w-full rounded-xl border border-[color:var(--border-strong)] bg-card p-3 text-[16px] md:text-[14.5px] text-ink outline-none focus:border-amber";
  const primaryBtn =
    "inline-flex items-center gap-1.5 rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70 max-md:min-h-[44px]";

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close Report an issue"
        onClick={onClose}
        className="absolute inset-0 bg-[#1e1a12]/40"
      />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-canvas shadow-[-8px_0_40px_rgba(42,33,24,0.18)]">
        {/* Header */}
        <div className="relative overflow-hidden bg-chrome px-6 pb-6 pt-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-[20px] leading-none text-bone">
                Report an issue
              </h2>
              <p className="mt-1 text-[12.5px] text-bone/65">
                Tell us what broke, what is confusing, or an idea. We turn it into a clear note for the build team.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-m-2 flex h-11 w-11 shrink-0 items-center justify-center text-bone/70 transition-colors hover:text-bone"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 pb-[calc(24px+env(safe-area-inset-bottom))] pt-6">
          {/* Kind selector in describe, a static chip afterward. */}
          {phase === "describe" ? (
            <div className="mb-5">
              <span className={label}>What are you reporting?</span>
              <div className="flex flex-wrap gap-2">
                {KINDS.map((k) => {
                  const Icon = k.icon;
                  const active = kind === k.key;
                  return (
                    <button
                      key={k.key}
                      type="button"
                      onClick={() => setKind(k.key)}
                      className={`flex flex-1 basis-[120px] items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-[13px] font-semibold transition-colors max-md:min-h-[44px] ${
                        active
                          ? "border-amber bg-amber/10 text-ink"
                          : "border-[color:var(--border-hair)] text-[color:var(--color-text-muted)] hover:border-[color:var(--border-strong)]"
                      }`}
                    >
                      <Icon size={15} aria-hidden="true" />
                      {k.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-bark">
              {(() => {
                const found = KINDS.find((k) => k.key === kind);
                const Icon = found?.icon ?? Bug;
                return <Icon size={14} aria-hidden="true" />;
              })()}
              <span>{KINDS.find((k) => k.key === kind)?.label}</span>
            </div>
          )}

          {/* DESCRIBE */}
          {phase === "describe" && (
            <>
              <span className={label}>Tell us what happened</span>
              <textarea
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={PLACEHOLDER[kind]}
                rows={4}
                className={textarea}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") startInterview();
                }}
              />

              {/* Photo attach */}
              <div className="mt-3.5">
                {photo ? (
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.preview}
                      alt="attachment preview"
                      className="h-14 w-14 rounded-[10px] border border-[color:var(--border-hair)] object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setPhoto(null)}
                      className="-m-2 p-2 text-[13px] text-[color:var(--color-text-muted)] hover:text-ink"
                    >
                      Remove screenshot
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-1.5 rounded-[10px] border border-dashed border-[color:var(--border-strong)] px-3.5 py-2 text-[13px] text-[color:var(--color-text-muted)] hover:text-ink max-md:min-h-[44px]"
                  >
                    <Camera size={14} aria-hidden="true" />
                    Add a screenshot
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={onPickPhoto}
                  className="hidden"
                />
              </div>

              {error ? <ErrorLine text={error} /> : null}

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={startInterview}
                  disabled={!draft.trim() || busy}
                  className={primaryBtn}
                >
                  {busy ? "Thinking" : "Continue"}
                  {!busy ? <Send size={14} aria-hidden="true" /> : null}
                </button>
              </div>
            </>
          )}

          {/* CHAT */}
          {phase === "chat" && (
            <>
              <div
                ref={scrollRef}
                className="flex max-h-[42vh] flex-col gap-2.5 overflow-y-auto pr-0.5"
              >
                {turns.map((t, i) => (
                  <Bubble key={i} role={t.role} text={t.content} />
                ))}
                {busy ? <Bubble role="assistant" text="…" muted /> : null}
              </div>

              {error ? <ErrorLine text={error} /> : null}

              <div className="mt-3.5">
                <textarea
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Type your answer"
                  disabled={busy}
                  rows={2}
                  className={textarea}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") answer();
                  }}
                />
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={answer}
                  disabled={!draft.trim() || busy}
                  className={primaryBtn}
                >
                  Send
                  <Send size={14} aria-hidden="true" />
                </button>
              </div>
            </>
          )}

          {/* SENDING */}
          {phase === "sending" && (
            <div className="py-8 text-center">
              <div className="font-[family-name:var(--font-display)] text-[20px] italic text-ink">
                Filing your report
              </div>
              <div className="mt-2 text-[13px] text-[color:var(--color-text-muted)]">
                The guide has what it needs. One second.
              </div>
            </div>
          )}

          {/* DONE */}
          {phase === "done" && (
            <div>
              <div className="px-0 pb-2 pt-3 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-forest text-bone">
                  <Check size={20} aria-hidden="true" />
                </span>
                <div className="mt-3 font-[family-name:var(--font-display)] text-[22px] italic text-ink">
                  Sent to the build team
                </div>
                <div className="mt-2 text-[13px] leading-[1.5] text-[color:var(--color-text-muted)]">
                  Thank you. We turned this into a clear note{brief?.title ? `: "${brief.title}"` : ""}.
                </div>
              </div>

              {/* Owner-only: the paste-ready engineering brief. */}
              {operator && brief ? (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <span className={label + " mb-0"}>Engineering brief</span>
                    <button
                      type="button"
                      onClick={copyBrief}
                      className="inline-flex items-center gap-1 rounded-full border border-amber px-3 py-1 text-[12px] font-semibold text-amber-deep hover:bg-amber/10 max-md:min-h-[44px]"
                    >
                      {copied ? <Check size={12} /> : <Copy size={12} />}
                      {copied ? "Copied" : "Copy prompt"}
                    </button>
                  </div>
                  <pre className="max-h-[34vh] overflow-y-auto whitespace-pre-wrap break-words rounded-xl border border-[color:var(--border-hair)] bg-card p-4 font-mono text-[12.5px] leading-[1.6] text-[color:var(--color-text)]">
                    {brief.prompt}
                  </pre>
                </div>
              ) : null}

              <div className="mt-5 flex justify-center">
                <button type="button" onClick={onClose} className={primaryBtn}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function Bubble({
  role,
  text,
  muted,
}: {
  role: "user" | "assistant";
  text: string;
  muted?: boolean;
}) {
  const isUser = role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-[14px] leading-[1.5] ${
          isUser
            ? "rounded-br-sm bg-forest text-bone"
            : "rounded-bl-sm border border-[color:var(--border-hair)] bg-card text-[color:var(--color-text)]"
        } ${muted ? "opacity-60" : ""}`}
      >
        {text}
      </div>
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p role="alert" className="mt-3 text-[13px] text-[color:var(--color-state-error)]">
      {text}
    </p>
  );
}
