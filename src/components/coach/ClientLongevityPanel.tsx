"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, Plus, Settings2 } from "lucide-react";
import { recordClientAssessment } from "@/lib/longevity/actions";
import type { Band, Longevity } from "@/lib/data/wellness";
import { BAND_DOT, BAND_LABEL, BandChip, Trend, fmtValue } from "@/components/longevity/LongevityBits";

const BANDS: Band[] = ["healthy", "improving", "needs_attention"];

export function ClientLongevityPanel({
  clientId,
  longevity,
}: {
  clientId: string;
  longevity: Longevity;
}) {
  const router = useRouter();
  const [showRecord, setShowRecord] = useState(false);
  const [assessmentId, setAssessmentId] = useState("");
  const [value, setValue] = useState("");
  const [source, setSource] = useState<"coach_observed" | "device_estimate">("coach_observed");
  const [band, setBand] = useState<Band | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();

  const allTests = longevity.pillars.flatMap((p) => p.tests);
  const selected = allTests.find((t) => t.assessmentId === assessmentId) ?? null;
  const isJudgment = selected?.usesCoachJudgment ?? false;
  const isObservation = isJudgment || (selected ? ["pass", "photo"].includes(selected.unit) : false);

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
      const res = await recordClientAssessment(clientId, {
        assessmentId,
        source,
        ...(isObservation ? { valueText: value } : { value }),
        ...(isJudgment && band ? { band } : {}),
      });
      if (res.error) setErr(res.error);
      else {
        setValue("");
        setBand(null);
        setSaved(true);
        router.refresh();
      }
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
            Longevity
          </h2>
          <p className="text-[12.5px] text-[color:var(--color-text-muted)]">
            Capacity over time. A starting point for a conversation, not a medical read.
          </p>
        </div>
        <Link
          href="/fitness/assessments"
          className="hidden items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] px-3 py-1.5 text-[12.5px] font-semibold text-forest transition-colors hover:bg-inset sm:inline-flex"
        >
          <Settings2 size={14} aria-hidden="true" />
          Tests
        </Link>
        <button
          type="button"
          onClick={() => setShowRecord((s) => !s)}
          className="inline-flex items-center gap-1.5 rounded-full bg-amber px-3.5 py-2 text-[13px] font-semibold text-[#23170c] transition hover:bg-amber-deep max-md:min-h-[44px] max-md:px-4"
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
                setBand(null);
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
                className="ww-input w-full sm:w-36"
                inputMode={isObservation ? "text" : "decimal"}
                placeholder={
                  selected
                    ? isJudgment
                      ? "What you saw (optional)"
                      : isObservation
                        ? "What you saw"
                        : selected.unit
                    : "Result"
                }
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <button
                type="button"
                onClick={save}
                disabled={pending || !assessmentId}
                className="shrink-0 rounded-full bg-forest px-4 py-2 text-[13px] font-semibold text-bone transition hover:bg-forest-deep disabled:opacity-60 max-md:min-h-[44px]"
              >
                {pending ? "Saving" : "Save"}
              </button>
            </div>
          </div>
          <div className="mt-2.5 flex items-center gap-2">
            {(["coach_observed", "device_estimate"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSource(s)}
                className={`rounded-full px-3 py-1 text-[12px] font-medium transition max-md:min-h-[44px] max-md:px-4 ${
                  source === s
                    ? "bg-forest text-bone"
                    : "border border-[color:var(--border-strong)] text-[color:var(--color-text-muted)] hover:bg-inset"
                }`}
              >
                {s === "coach_observed" ? "Observed" : "Device estimate"}
              </button>
            ))}
          </div>
          {isJudgment ? (
            <div className="mt-2.5">
              <p className="text-[12px] text-bark">Your read on the day</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                {BANDS.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => setBand(band === b ? null : b)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12px] font-medium transition max-md:min-h-[44px] max-md:px-4 ${
                      band === b
                        ? "bg-forest text-bone"
                        : "border border-[color:var(--border-strong)] text-[color:var(--color-text-muted)] hover:bg-inset"
                    }`}
                  >
                    <span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: BAND_DOT[b] }}
                      aria-hidden="true"
                    />
                    {BAND_LABEL[b]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
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
          {saved ? <p className="mt-2 text-[13px] text-forest">Recorded.</p> : null}
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
          No assessments yet. Record a test to start their longevity profile.
        </div>
      )}
    </section>
  );
}
