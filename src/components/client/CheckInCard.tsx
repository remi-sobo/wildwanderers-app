"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Mic, Square } from "lucide-react";
import { submitTextCheckIn, submitVoiceCheckIn } from "@/lib/wellness/checkin-actions";
import type { CheckIn } from "@/lib/data/checkins";

// A client leaves a short reflection for Gabe, by text or voice. Coach
// structures it on Gabe's side, with his approval, never automatically.
export function CheckInCard({ recent, voiceEnabled }: { recent: CheckIn[]; voiceEnabled: boolean }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  function send() {
    setError(null);
    setSent(false);
    startTransition(async () => {
      const res = await submitTextCheckIn(body);
      if (res.error) setError(res.error);
      else {
        setBody("");
        setSent(true);
      }
    });
  }

  async function startRecording() {
    setError(null);
    setSent(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setTranscribing(true);
        const fd = new FormData();
        fd.append("audio", blob, "checkin.webm");
        const res = await submitVoiceCheckIn(fd);
        setTranscribing(false);
        if (res.error) setError(res.error);
        else {
          setSent(true);
          router.refresh();
        }
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("Could not reach your microphone. Check permissions, or use text.");
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <>
      <textarea
        value={body}
        onChange={(e) => {
          setSent(false);
          setBody(e.target.value);
        }}
        rows={3}
        placeholder="How did the week go? What felt good, what got in the way?"
        className="w-full rounded-xl border border-[color:var(--border-strong)] bg-canvas p-3 text-[14.5px] text-ink"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={send}
          disabled={pending || !body.trim()}
          className="rounded-full bg-amber px-5 py-2.5 text-[14px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70"
        >
          {pending ? "Sending" : "Send check-in"}
        </button>

        {voiceEnabled ? (
          recording ? (
            <button
              type="button"
              onClick={stopRecording}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--color-state-error)]/40 bg-[color:var(--color-state-error)]/8 px-4 py-2.5 text-[13.5px] font-semibold text-[color:var(--color-state-error)]"
            >
              <Square size={13} fill="currentColor" aria-hidden="true" />
              Stop and send
              <span className="ml-1 h-2 w-2 animate-pulse rounded-full bg-[color:var(--color-state-error)]" />
            </button>
          ) : (
            <button
              type="button"
              onClick={startRecording}
              disabled={transcribing}
              className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-strong)] px-4 py-2.5 text-[13.5px] font-semibold text-forest transition-colors hover:bg-inset disabled:opacity-70"
            >
              <Mic size={15} aria-hidden="true" />
              {transcribing ? "Transcribing" : "Record instead"}
            </button>
          )
        ) : null}

        {sent ? (
          <span className="flex items-center gap-1 text-[13px] text-fern">
            <Check size={15} /> Sent to your coach
          </span>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">
          {error}
        </p>
      ) : null}

      {recent.length > 0 ? (
        <ul className="mt-5 flex flex-col gap-2 border-t border-[color:var(--border-hair)] pt-4">
          {recent.map((c) => (
            <li key={c.id} className="text-[13px]">
              <div className="flex items-center justify-between">
                <span className="text-[color:var(--color-text-muted)]">
                  {new Date(c.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span className="text-[11px] capitalize text-[color:var(--color-text-faint)]">
                  {c.status === "reviewed" ? "Reviewed" : "Sent"}
                </span>
              </div>
              {c.body ? (
                <p className="mt-0.5 line-clamp-2 text-[color:var(--color-text)]">{c.body}</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}
