"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  requestPasswordReset,
  type ResetRequestState,
} from "@/lib/auth/password-reset";

const initialState: ResetRequestState = { sent: false, error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="submit" disabled={pending}>
      <span className="submit-label">
        {pending ? "Sending" : "Send reset link"}
      </span>
      <span aria-hidden="true" className="submit-arrow">
        &rarr;
      </span>
    </button>
  );
}

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, initialState);

  if (state.sent) {
    return (
      <div className="w-full max-w-[360px]">
        <p className="eyebrow flex items-center gap-3 text-bark">
          <span aria-hidden="true" className="h-px w-6 bg-bark" />
          Password reset
        </p>
        <h1 className="mt-5 font-[family-name:var(--font-display)] text-[42px] leading-none tracking-[-0.02em] text-forest-deep">
          Check your <em className="italic text-bark">inbox.</em>
        </h1>
        <p className="mt-3.5 text-[14.5px] leading-[1.5] text-[color:var(--color-text-muted)]">
          If that email has an account, a reset link is on its way. Follow it to
          set a new password.
        </p>
        <div className="mt-9 border-t border-[color:var(--border-hair)] pt-6">
          <Link href="/login" className="ww-link -m-2 inline-block p-2 text-sm font-semibold text-forest">
            Back to sign in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="w-full max-w-[360px]" noValidate>
      <p className="eyebrow flex items-center gap-3 text-bark">
        <span aria-hidden="true" className="h-px w-6 bg-bark" />
        Password reset
      </p>

      <h1 className="mt-5 font-[family-name:var(--font-display)] text-[42px] leading-none tracking-[-0.02em] text-forest-deep">
        Reset your <em className="italic text-bark">password.</em>
      </h1>

      <p className="mt-3.5 text-[14.5px] leading-[1.5] text-[color:var(--color-text-muted)]">
        Enter your email and we will send a link to set a new one.
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
          htmlFor="email"
          className="mb-2 block text-[12.5px] font-semibold tracking-[0.01em] text-ink"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@email.com"
          className="ww-input"
        />
      </div>

      <SubmitButton />

      <div className="mt-9 border-t border-[color:var(--border-hair)] pt-6 text-center">
        <p className="text-[13.5px] text-[color:var(--color-text-muted)]">
          Remembered it?{" "}
          <Link href="/login" className="ww-link font-semibold text-forest">
            Back to sign in
          </Link>
        </p>
      </div>
    </form>
  );
}
