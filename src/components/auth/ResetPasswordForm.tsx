"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  updatePassword,
  type UpdatePasswordState,
} from "@/lib/auth/password-reset";

const initialState: UpdatePasswordState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="submit" disabled={pending}>
      <span className="submit-label">
        {pending ? "Updating" : "Update password"}
      </span>
      <span aria-hidden="true" className="submit-arrow">
        &rarr;
      </span>
    </button>
  );
}

export function ResetPasswordForm() {
  const [state, formAction] = useActionState(updatePassword, initialState);

  return (
    <form action={formAction} className="w-full max-w-[360px]" noValidate>
      <p className="eyebrow flex items-center gap-3 text-bark">
        <span aria-hidden="true" className="h-px w-6 bg-bark" />
        Password reset
      </p>

      <h1 className="mt-5 font-[family-name:var(--font-display)] text-[42px] leading-none tracking-[-0.02em] text-forest-deep">
        Choose a new <em className="italic text-bark">password.</em>
      </h1>

      <p className="mt-3.5 text-[14.5px] leading-[1.5] text-[color:var(--color-text-muted)]">
        Pick something you will remember. At least 8 characters.
      </p>

      {state.error ? (
        <p
          role="alert"
          className="mt-6 rounded-xl border border-[color:var(--color-state-error)]/30 bg-[color:var(--color-state-error)]/8 px-4 py-3 text-[13.5px] leading-snug text-[color:var(--color-state-error)]"
        >
          {state.error}
        </p>
      ) : null}

      <div className="mt-8">
        <label
          htmlFor="password"
          className="mb-2 block text-[12.5px] font-semibold tracking-[0.01em] text-ink"
        >
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          placeholder="••••••••"
          className="ww-input"
        />
      </div>

      <div className="mt-5">
        <label
          htmlFor="confirm"
          className="mb-2 block text-[12.5px] font-semibold tracking-[0.01em] text-ink"
        >
          Confirm password
        </label>
        <input
          id="confirm"
          name="confirm"
          type="password"
          autoComplete="new-password"
          required
          placeholder="••••••••"
          className="ww-input"
        />
      </div>

      <SubmitButton />
    </form>
  );
}
