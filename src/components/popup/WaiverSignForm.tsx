"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { signPopupWaiver, type SignInput } from "@/lib/popup/sign-action";

// The guest's own-phone waiver. The text is Gabe's document, shown as stored.
// A numbered paragraph's lead sentence ("1. What this is.") is set in bold,
// the way the paper copy reads.

const field =
  "h-12 w-full rounded-xl border border-[color:var(--border-strong)] bg-card px-3.5 text-[16px] text-ink outline-none focus:border-amber";
const label = "mb-1.5 block text-[13px] font-semibold text-[color:var(--color-text)]";

function WaiverText({ body }: { body: string }) {
  return (
    <div className="flex flex-col gap-3 text-[14.5px] leading-relaxed text-[color:var(--color-text)]">
      {body.split(/\n\s*\n/).map((para, i) => {
        const m = para.match(/^(\d+\.\s+[^.]+\.)\s+([\s\S]*)$/);
        if (m) {
          return (
            <p key={i}>
              <strong className="font-semibold text-forest-deep">{m[1]}</strong> {m[2]}
            </p>
          );
        }
        return (
          <p key={i} className="text-[13px] italic text-[color:var(--color-text-muted)]">
            {para}
          </p>
        );
      })}
    </div>
  );
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`h-12 flex-1 rounded-xl border text-[15px] font-semibold transition-colors ${
        active ? "border-forest bg-forest text-bone" : "border-[color:var(--border-strong)] bg-card text-ink"
      }`}
    >
      {children}
    </button>
  );
}

export function WaiverSignForm({ token, title, body }: { token: string; title: string; body: string }) {
  const [f, setF] = useState<SignInput>({
    fullName: "",
    email: "",
    phone: "",
    isMinor: false,
    age: "",
    emergencyName: "",
    emergencyPhone: "",
    photoOk: null,
    agreed: false,
    signedName: "",
    guardianName: "",
    guardianRelationship: "",
    joinList: false,
    company: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ here: boolean; name: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof SignInput>(k: K, v: SignInput[K]) => setF((p) => ({ ...p, [k]: v }));

  if (done) {
    return (
      <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-6 shadow-[var(--shadow-card)]">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--color-fern)] text-bone">
          <Check size={24} strokeWidth={2.2} aria-hidden="true" />
        </span>
        <p className="mt-4 font-[family-name:var(--font-display)] text-[24px] leading-tight text-forest-deep">
          You&apos;re signed in{done.name ? `, ${done.name}` : ""}.
        </p>
        <p className="mt-2 text-[15px] text-[color:var(--color-text)]">
          {done.here
            ? "Gabe can see you're here. Go find a spot."
            : "Your waiver is on file for the season. See you Saturday."}
        </p>
        <button
          type="button"
          onClick={() => {
            setDone(null);
            setF((p) => ({ ...p, fullName: "", isMinor: false, age: "", photoOk: null, agreed: false, signedName: "" }));
          }}
          className="mt-5 h-12 w-full rounded-xl border border-[color:var(--border-strong)] text-[15px] font-semibold text-forest"
        >
          Sign for someone else
        </button>
      </div>
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await signPopupWaiver(token, f);
      if (res.ok) {
        setDone({ here: res.here, name: f.fullName.trim().split(/\s+/)[0] ?? "" });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
        <h2 className="font-[family-name:var(--font-display)] text-[19px] leading-snug text-forest-deep">{title}</h2>
        <div className="mt-4">
          <WaiverText body={body} />
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
        <p className="eyebrow text-bark">Who is working out</p>
        <div>
          <label className={label} htmlFor="ws-name">Participant name</label>
          <input id="ws-name" className={field} autoComplete="name" value={f.fullName}
            onChange={(e) => set("fullName", e.target.value)} />
        </div>
        <div>
          <span className={label}>Is the participant under 18?</span>
          <div className="flex gap-2">
            <Choice active={!f.isMinor} onClick={() => set("isMinor", false)}>No, 18 or older</Choice>
            <Choice active={f.isMinor} onClick={() => set("isMinor", true)}>Yes</Choice>
          </div>
        </div>
        {f.isMinor ? (
          <div>
            <label className={label} htmlFor="ws-age">Age (participants must be 10 or older)</label>
            <input id="ws-age" className={field} inputMode="numeric" value={f.age}
              onChange={(e) => set("age", e.target.value.replace(/\D/g, "").slice(0, 2))} />
          </div>
        ) : null}
        <div>
          <label className={label} htmlFor="ws-email">{f.isMinor ? "Parent or guardian email" : "Email"}</label>
          <input id="ws-email" className={field} type="email" autoComplete="email" inputMode="email" value={f.email}
            onChange={(e) => set("email", e.target.value)} />
        </div>
        <div>
          <label className={label} htmlFor="ws-phone">Phone</label>
          <input id="ws-phone" className={field} type="tel" autoComplete="tel" value={f.phone}
            onChange={(e) => set("phone", e.target.value)} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={label} htmlFor="ws-ec-name">Emergency contact name</label>
            <input id="ws-ec-name" className={field} value={f.emergencyName}
              onChange={(e) => set("emergencyName", e.target.value)} />
          </div>
          <div>
            <label className={label} htmlFor="ws-ec-phone">Emergency contact phone</label>
            <input id="ws-ec-phone" className={field} type="tel" value={f.emergencyPhone}
              onChange={(e) => set("emergencyPhone", e.target.value)} />
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
        <div>
          <span className={label}>I&apos;m okay with the participant appearing in photos</span>
          <div className="flex gap-2">
            <Choice active={f.photoOk === true} onClick={() => set("photoOk", true)}>Yes</Choice>
            <Choice active={f.photoOk === false} onClick={() => set("photoOk", false)}>No</Choice>
          </div>
        </div>

        {f.isMinor ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="ws-g-name">Parent or guardian printed name</label>
              <input id="ws-g-name" className={field} value={f.guardianName}
                onChange={(e) => set("guardianName", e.target.value)} />
            </div>
            <div>
              <label className={label} htmlFor="ws-g-rel">Relationship to participant</label>
              <input id="ws-g-rel" className={field} value={f.guardianRelationship}
                onChange={(e) => set("guardianRelationship", e.target.value)} />
            </div>
          </div>
        ) : null}

        <label className="flex min-h-12 items-start gap-3 text-[15px] text-ink">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[color:var(--color-forest)]" checked={f.agreed}
            onChange={(e) => set("agreed", e.target.checked)} />
          <span>I have read this agreement, I understand it, and I sign it freely.</span>
        </label>

        <div>
          <label className={label} htmlFor="ws-sign">
            {f.isMinor ? "Parent or guardian signature (type your full name)" : "Signature (type your full name)"}
          </label>
          <input id="ws-sign" className={`${field} font-[family-name:var(--font-display)] italic`} value={f.signedName}
            onChange={(e) => set("signedName", e.target.value)} />
          <p className="mt-1.5 text-[12.5px] text-[color:var(--color-text-muted)]">
            Typing your name here counts as your signature. Today&apos;s date is recorded with it.
          </p>
        </div>

        <label className="flex min-h-12 items-start gap-3 text-[15px] text-ink">
          <input type="checkbox" className="mt-1 h-5 w-5 accent-[color:var(--color-forest)]" checked={f.joinList}
            onChange={(e) => set("joinList", e.target.checked)} />
          <span>Email me the date and spot before each Saturday.</span>
        </label>

        {/* Honeypot: hidden from people, tempting to bots. */}
        <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true"
          className="hidden" value={f.company} onChange={(e) => set("company", e.target.value)} />

        {error ? (
          <p role="alert" className="text-[14px] text-[color:var(--color-state-error)]">{error}</p>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="h-14 w-full rounded-full bg-amber text-[16px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-70"
        >
          {pending ? "Signing..." : "Sign and check in"}
        </button>
      </section>
    </form>
  );
}
