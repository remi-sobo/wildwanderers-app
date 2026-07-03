"use client";

import { useEffect, useRef } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { scheduleSession, type ScheduleSessionState } from "@/lib/coach/actions";

const initialState: ScheduleSessionState = { error: null, ok: false };

const fieldClass =
  "h-11 rounded-[10px] border border-[color:var(--border-strong)] bg-card px-3 text-[14px] text-ink";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-full bg-forest px-4 py-2 text-[13.5px] font-semibold text-bone transition-colors hover:bg-forest-deep disabled:opacity-50"
    >
      {pending ? "Scheduling" : "Schedule"}
    </button>
  );
}

export function ScheduleSessionForm({ clientId }: { clientId: string }) {
  const [state, formAction] = useActionState(scheduleSession, initialState);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state.ok]);

  return (
    <form
      ref={ref}
      action={formAction}
      className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]"
    >
      <input type="hidden" name="client_id" value={clientId} />
      <p className="eyebrow text-bark">Schedule a session</p>

      {state.error ? (
        <p role="alert" className="mt-3 text-[13px] text-[color:var(--color-state-error)]">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="mt-3 text-[13px] text-[color:var(--color-state-good)]">Session scheduled.</p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <input name="title" placeholder="Session title" className={`${fieldClass} min-w-[180px] flex-1`} />
        <select name="kind" defaultValue="training" className={`${fieldClass} w-[130px] capitalize`}>
          <option value="training">Training</option>
          <option value="check_in">Check-in</option>
          <option value="consult">Consult</option>
        </select>
        <input name="date" type="date" className={`${fieldClass} w-[150px]`} />
        <input name="time" type="time" className={`${fieldClass} w-[120px]`} />
        <SubmitButton />
      </div>
    </form>
  );
}
