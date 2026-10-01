"use client";

// The drafted first reply, inside the lead drawer. Scout writes two lengths,
// a text message and a short email; the owner edits inline, then copies or
// opens their own mail app. The app never sends anything. Degrades to the
// same quiet note as the other Scout assists when no key is set.

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Copy, Check, Mail } from "lucide-react";
import { draftFirstReply } from "@/lib/ai/lead-reply-actions";
import type { FirstReplyDraft } from "@/lib/business/first-reply";

const box =
  "w-full rounded-xl border border-[color:var(--border-strong)] bg-card p-3 text-[16px] leading-[1.55] text-ink outline-none focus:border-amber md:text-[14px]";
const sectionHead = "text-[12px] font-semibold uppercase tracking-[0.12em] text-bark";
const subLabel = "mb-1 flex items-center justify-between text-[12px] font-semibold text-ink";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copy ${label}`}
      className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-forest max-md:min-h-[44px]"
    >
      {copied ? <Check size={13} aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

export function FirstReplyPanel({
  leadId,
  email,
  initial,
  scoutReady,
  autoDraft,
}: {
  leadId: string;
  email: string | null;
  initial: FirstReplyDraft | null;
  scoutReady: boolean;
  autoDraft: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<FirstReplyDraft | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const autoRan = useRef(false);

  function run() {
    setError(null);
    start(async () => {
      const res = await draftFirstReply(leadId);
      if (res.error) setError(res.error);
      else if (res.draft) {
        setDraft(res.draft);
        router.refresh();
      }
    });
  }

  // Right after accept, draft once without a second tap.
  useEffect(() => {
    if (autoDraft && scoutReady && !initial && !autoRan.current) {
      autoRan.current = true;
      run();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoDraft, scoutReady, initial]);

  const mailto =
    draft && email
      ? `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.email)}`
      : null;

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className={sectionHead}>First reply</h3>
        {scoutReady ? (
          <button
            type="button"
            onClick={run}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-full border border-forest/25 bg-forest/5 px-3 py-1.5 text-[12.5px] font-semibold text-forest transition-colors hover:bg-forest/10 disabled:opacity-60 max-md:min-h-[44px]"
          >
            <Sparkles size={13} aria-hidden="true" />
            {pending ? "Drafting" : draft ? "Draft again" : "Draft with Scout"}
          </button>
        ) : null}
      </div>

      {!scoutReady ? (
        <p className="text-[12px] text-[color:var(--color-text-faint)]">
          Scout can draft a first reply here once its key is set in the deployment.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-[12.5px] text-[color:var(--color-state-error)]">{error}</p>
      ) : null}

      {pending && !draft ? (
        <p className="text-[13px] text-[color:var(--color-text-muted)]">Scout is drafting a reply in your voice.</p>
      ) : null}

      {draft ? (
        <div className="flex flex-col gap-4">
          <div>
            <div className={subLabel}>
              <span>
                Text message{" "}
                <span className="font-normal text-[color:var(--color-text-faint)]">· {draft.text.length} characters</span>
              </span>
              <CopyButton value={draft.text} label="text message" />
            </div>
            <textarea
              rows={4}
              value={draft.text}
              onChange={(e) => setDraft({ ...draft, text: e.target.value })}
              className={box}
            />
          </div>
          <div>
            <div className={subLabel}>
              <span>Email</span>
              <CopyButton value={`${draft.subject}\n\n${draft.email}`} label="email" />
            </div>
            <input
              value={draft.subject}
              onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
              aria-label="Email subject"
              className={`${box} mb-2 h-11 md:h-10`}
            />
            <textarea
              rows={7}
              value={draft.email}
              onChange={(e) => setDraft({ ...draft, email: e.target.value })}
              className={box}
            />
            {mailto ? (
              <a
                href={mailto}
                className="ww-link mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-forest max-md:min-h-[44px]"
              >
                <Mail size={14} aria-hidden="true" /> Open in your mail app
              </a>
            ) : null}
          </div>
          <p className="text-[12px] leading-[1.5] text-[color:var(--color-text-faint)]">
            A draft only. Fill any [day and time] with what you can really offer, then send it yourself.
          </p>
        </div>
      ) : null}
    </section>
  );
}
