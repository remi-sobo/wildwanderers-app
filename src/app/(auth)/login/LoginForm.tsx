"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { login, type LoginState } from "@/lib/auth/actions";

const initialState: LoginState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button type="submit" className="submit" disabled={pending}>
      <span className="submit-label">
        {pending ? "Signing in" : "Sign in"}
      </span>
      <span aria-hidden="true" className="submit-arrow">
        &rarr;
      </span>
    </button>
  );
}

export function LoginForm() {
  const [state, formAction] = useActionState(login, initialState);

  return (
    <form action={formAction} className="w-full max-w-[360px]" noValidate>
      <p className="eyebrow flex items-center gap-3 text-bark">
        <span aria-hidden="true" className="h-px w-6 bg-bark" />
        Client and coach sign in
      </p>

      <h1 className="mt-5 font-[family-name:var(--font-display)] text-[42px] leading-none tracking-[-0.02em] text-forest-deep">
        Welcome <em className="italic text-bark">back.</em>
      </h1>

      <p className="mt-3.5 text-[14.5px] leading-[1.5] text-[color:var(--color-text-muted)]">
        Sign in to your Wild Wanderers account.
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

      <div className="mt-5">
        <div className="flex items-baseline justify-between">
          <label
            htmlFor="password"
            className="mb-2 block text-[12.5px] font-semibold tracking-[0.01em] text-ink"
          >
            Password
          </label>
          <Link
            href="/forgot-password"
            className="text-xs font-semibold text-amber-deep"
          >
            Forgot password?
          </Link>
        </div>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="••••••••"
          className="ww-input"
        />
      </div>

      <SubmitButton />

      <div className="mt-9 border-t border-[color:var(--border-hair)] pt-6 text-center">
        <p className="text-[13.5px] text-[color:var(--color-text-muted)]">
          Not a client yet?{" "}
          <a
            href="https://wildwanderers.life"
            className="ww-link font-semibold text-forest"
          >
            Start the conversation &rarr;
          </a>
        </p>
      </div>
    </form>
  );
}
