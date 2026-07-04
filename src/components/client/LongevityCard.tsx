"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Activity, Plus, Lock } from "lucide-react";
import {
  recordSelfAssessment,
  grantBodyCompositionConsent,
  revokeBodyCompositionConsent,
} from "@/lib/wellness/actions";
import type { Longevity } from "@/lib/data/wellness";
import { BandChip, Trend, fmtValue } from "@/components/longevity/LongevityBits";

export function LongevityCard({ longevity }: { longevity: Longevity }) {
  const router = useRouter();
  const [showRecord, setShowRecord] = useState(false);
  const [assessmentId, setAssessmentId] = useState("");
  const [value, setValue] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const [bodyPending, startBody] = useTransition();

  const allTests = useMemo(
    () => longevity.pillars.flatMap((p) => p.tests),
    [longevity.pillars],
  );
  const selected = allTests.find((t) => t.assessmentId === assessmentId) ?? null;
  const isObservation = selected ? ["pass", "photo"].includes(selected.unit) : false;

  // Only pillars with at least one recorded result show in the profile body.
  const testedPillars = longevity.pillars
    .map((p) => ({ ...p, tests: p.tests.filter((t) => t.latestValue !== null || t.latestValueText) }))
    .filter((p) => p.tests.length > 0);

  function save() {
    if (!assessmentId) {
      setErr("Pick a test first.");
      return;
    }
    setErr(null);
    setSaved(false);
    start(async () => {
      const res = await recordSelfAssessment(
        isObservation
          ? { assessmentId, valueText: value }
          : { assessmentId, value },
      );
      if (res.error) setErr(res.error);
      else {
        setValue("");
        setSaved(true);
        router.refresh();
      }
    });
  }

  function toggleBody(on: boolean) {
    startBody(async () => {
      const res = on
        ? await grantBodyCompositionConsent()
        : await revokeBodyCompositionConsent();
      if (!res.error) router.refresh();
    });
  }

  return (
    <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3 border-b border-[color:var(--border-hair)] px-5 py-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-inset text-forest">
          <Activity size={17} strokeWidth={1.9} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-[family-name:var(--font-display)] text-[17px] text-forest-deep">
            Longevity profile
          </h2>
          <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
            {longevity.testedCount > 0
              ? `${longevity.testedCount} of ${longevity.totalCount} tests tried`
              : "Your capacity over time"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowRecord((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber px-3.5 py-2 text-[13px] font-semibold text-[#23170c] transition hover:bg-amber-deep"
        >
          <Plus size={15} strokeWidth={2.2} aria-hidden="true" />
          Record
        </button>
      </div>

      {showRecord ? (
        <div className="border-b border-[color:var(--border-hair)] bg-inset/40 px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <select
              className="ww-input"
              value={assessmentId}
              onChange={(e) => {
                setAssessmentId(e.target.value);
                setSaved(false);
                setErr(null);
              }}
            >
              <option value="">Pick a test</option>
              {longevity.pillars.map((p) => (
                <optgroup key={p.pillar} label={p.label}>
                  {p.tests.map((t) => (
                    <option key={t.assessmentId} value={t.assessmentId}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="flex gap-2">
              <input
                className="ww-input w-full sm:w-40"
                inputMode={isObservation ? "text" : "decimal"}
                placeholder={selected ? (isObservation ? "What you saw" : selected.unit) : "Result"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <button
                type="button"
                onClick={save}
                disabled={pending || !assessmentId}
                className="shrink-0 rounded-full bg-forest px-4 py-2 text-[13px] font-semibold text-bone transition hover:bg-forest-deep disabled:opacity-60"
              >
                {pending ? "Saving" : "Save"}
              </button>
            </div>
          </div>
          {selected?.howTo ? (
            <p className="mt-2 text-[12.5px] leading-[1.5] text-[color:var(--color-text-muted)]">
              {selected.howTo}
            </p>
          ) : null}
          {err ? (
            <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">
              {err}
            </p>
          ) : null}
          {saved ? (
            <p className="mt-2 text-[13px] text-forest">Saved. Nice work.</p>
          ) : null}
          <p className="mt-3 text-[11.5px] leading-[1.5] text-[color:var(--color-text-muted)]">
            A fitness self-assessment, not a medical measurement. A band is a
            starting point for a conversation with your coach, never a grade.
          </p>
        </div>
      ) : null}

      {testedPillars.length > 0 ? (
        <div className="flex flex-col gap-5 px-5 py-5">
          {testedPillars.map((p) => (
            <div key={p.pillar}>
              <p className="eyebrow text-bark">{p.label}</p>
              <ul className="mt-2 flex flex-col gap-2.5">
                {p.tests.map((t) => (
                  <li key={t.assessmentId} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 flex-1 truncate text-[14px] text-forest-deep">
                      {t.name}
                    </span>
                    <span className="flex items-center gap-1.5 text-[13px] tabular-nums text-[color:var(--color-text-muted)]">
                      {fmtValue(t)}
                      <Trend test={t} />
                    </span>
                    <span className="w-[116px] shrink-0 text-right">
                      <BandChip band={t.latestBand} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-5 py-6 text-[13.5px] leading-[1.55] text-[color:var(--color-text-muted)]">
          No results yet. Record a test and watch your capacity build over time,
          alongside your daily wellness score.
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-[color:var(--border-hair)] px-5 py-3.5">
        <span className="flex items-center gap-2 text-[12.5px] text-[color:var(--color-text-muted)]">
          <Lock size={13} strokeWidth={1.9} aria-hidden="true" />
          Body composition {longevity.showBodyComposition ? "is on" : "is off"}
        </span>
        <button
          type="button"
          onClick={() => toggleBody(!longevity.showBodyComposition)}
          disabled={bodyPending}
          className="ww-link text-[12.5px] font-medium text-forest disabled:opacity-60"
        >
          {longevity.showBodyComposition ? "Turn off" : "Turn on"}
        </button>
      </div>
    </section>
  );
}
