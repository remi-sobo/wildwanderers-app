"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { addClient, type AddClientState } from "@/lib/coach/actions";

const initialState: AddClientState = { error: null };

const labelClass =
  "mb-2 block text-[12.5px] font-semibold tracking-[0.01em] text-ink";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="submit !mt-0 max-w-[220px]" disabled={pending}>
      <span className="submit-label">{pending ? "Adding" : "Add client"}</span>
      <span aria-hidden="true" className="submit-arrow">
        &rarr;
      </span>
    </button>
  );
}

export function AddClientForm() {
  const [state, formAction] = useActionState(addClient, initialState);

  return (
    <form action={formAction} className="flex max-w-xl flex-col gap-6" noValidate>
      {state.error ? (
        <p
          role="alert"
          className="rounded-xl border border-[color:var(--color-state-error)]/30 bg-[color:var(--color-state-error)]/8 px-4 py-3 text-[13.5px] leading-snug text-[color:var(--color-state-error)]"
        >
          {state.error}
        </p>
      ) : null}

      <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-6 shadow-[var(--shadow-card)]">
        <p className="eyebrow text-bark">Client</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="first_name" className={labelClass}>First name</label>
            <input id="first_name" name="first_name" required className="ww-input" />
          </div>
          <div>
            <label htmlFor="last_name" className={labelClass}>Last name</label>
            <input id="last_name" name="last_name" className="ww-input" />
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor="goal" className={labelClass}>Goal</label>
          <input
            id="goal"
            name="goal"
            placeholder="What are they working toward?"
            className="ww-input"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-6 shadow-[var(--shadow-card)]">
        <p className="eyebrow text-bark">Login (optional)</p>
        <p className="mt-2 text-[13px] leading-[1.5] text-[color:var(--color-text-muted)]">
          Add an email and a temporary password to create their sign-in now. Leave
          it blank to add the record and invite them later.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="email" className={labelClass}>Email</label>
            <input id="email" name="email" type="email" autoComplete="off" className="ww-input" />
          </div>
          <div>
            <label htmlFor="password" className={labelClass}>Temporary password</label>
            <input
              id="password"
              name="password"
              type="text"
              autoComplete="off"
              placeholder="At least 8 characters"
              className="ww-input"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <SubmitButton />
        <Link
          href="/program"
          className="ww-link inline-flex items-center text-sm font-semibold text-forest max-md:min-h-[44px]"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
