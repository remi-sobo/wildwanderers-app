"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil } from "lucide-react";
import { addAssessment, updateAssessment } from "@/lib/longevity/actions";
import { PILLAR_ORDER, PILLAR_LABEL, type PillarKey } from "@/lib/longevity/pillars";
import type { CatalogGroup, CatalogTest } from "@/lib/data/longevity";

const field =
  "h-11 md:h-10 rounded-lg border border-[color:var(--border-strong)] bg-card px-3 text-[16px] md:text-[14px] text-ink";

function TestRow({ test }: { test: CatalogTest }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [improving, setImproving] = useState(test.bandImproving?.toString() ?? "");
  const [healthy, setHealthy] = useState(test.bandHealthy?.toString() ?? "");
  const [howTo, setHowTo] = useState(test.howTo ?? "");
  const [active, setActive] = useState(test.isActive);
  const [judgment, setJudgment] = useState(test.usesCoachJudgment);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const bandSummary = test.usesCoachJudgment
    ? "Banded by your read on the day"
    : test.bandImproving === null || test.bandHealthy === null
      ? "No band set"
      : `${test.higherIsBetter ? "≥" : "≤"} ${test.bandImproving} improving · ${
          test.higherIsBetter ? "≥" : "≤"
        } ${test.bandHealthy} healthy`;

  function save() {
    setErr(null);
    start(async () => {
      const res = await updateAssessment(test.id, {
        bandImproving: improving,
        bandHealthy: healthy,
        howTo,
        isActive: active,
        useCoachJudgment: judgment,
      });
      if (res.error) setErr(res.error);
      else {
        setEditing(false);
        router.refresh();
      }
    });
  }

  return (
    <li className="rounded-xl border border-[color:var(--border-hair)] bg-card px-4 py-3 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] text-forest-deep">
            {test.name}
            {!test.isActive ? (
              <span className="ml-2 text-[11px] text-[color:var(--color-text-muted)]">hidden</span>
            ) : null}
            {test.boysExperienceName ? (
              <span className="ml-2 text-[11px] text-fern">{test.boysExperienceName}</span>
            ) : null}
          </p>
          <p className="text-[12px] text-[color:var(--color-text-muted)]">
            {test.unit} · {bandSummary}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditing((e) => !e)}
          className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--border-strong)] px-3 py-1.5 text-[12.5px] font-semibold text-forest transition-colors hover:bg-inset max-md:min-h-[44px] max-md:px-4"
        >
          <Pencil size={13} aria-hidden="true" />
          Edit
        </button>
      </div>

      {editing ? (
        <div className="mt-3 border-t border-[color:var(--border-hair)] pt-3">
          <label className="flex flex-col gap-1 text-[12px] text-bark">
            How it is banded
            <select
              className={field}
              value={judgment ? "judgment" : "thresholds"}
              onChange={(e) => setJudgment(e.target.value === "judgment")}
            >
              <option value="thresholds">Simple targets I set</option>
              <option value="judgment">My read on the day</option>
            </select>
          </label>
          {!judgment ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-[12px] text-bark">
                Improving band ({test.higherIsBetter ? "at least" : "at most"})
                <input
                  className={field}
                  inputMode="decimal"
                  value={improving}
                  onChange={(e) => setImproving(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1 text-[12px] text-bark">
                Healthy band ({test.higherIsBetter ? "at least" : "at most"})
                <input
                  className={field}
                  inputMode="decimal"
                  value={healthy}
                  onChange={(e) => setHealthy(e.target.value)}
                />
              </label>
            </div>
          ) : null}
          <label className="mt-3 flex flex-col gap-1 text-[12px] text-bark">
            How to measure
            <textarea
              className="min-h-[64px] rounded-lg border border-[color:var(--border-strong)] bg-card px-3 py-2 text-[16px] md:text-[14px] text-ink"
              value={howTo}
              onChange={(e) => setHowTo(e.target.value)}
            />
          </label>
          <label className="mt-3 flex items-center gap-2 text-[13px] text-forest-deep">
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
            />
            Show this test to clients
          </label>
          {err ? (
            <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">
              {err}
            </p>
          ) : null}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={pending}
              className="rounded-full bg-forest px-4 py-2 text-[13px] font-semibold text-bone transition hover:bg-forest-deep disabled:opacity-60 max-md:min-h-[44px]"
            >
              {pending ? "Saving" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full px-4 py-2 text-[13px] font-medium text-[color:var(--color-text-muted)] hover:text-forest max-md:min-h-[44px]"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function AddTest() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [name, setName] = useState("");
  const [pillar, setPillar] = useState<PillarKey>("be_strong");
  const [unit, setUnit] = useState("");
  const [higher, setHigher] = useState(true);
  const [improving, setImproving] = useState("");
  const [healthy, setHealthy] = useState("");
  const [judgment, setJudgment] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function add() {
    setErr(null);
    start(async () => {
      const res = await addAssessment({
        name,
        pillar,
        unit,
        higherIsBetter: higher,
        bandImproving: judgment ? "" : improving,
        bandHealthy: judgment ? "" : healthy,
        useCoachJudgment: judgment,
      });
      if (res.error) setErr(res.error);
      else {
        setName("");
        setUnit("");
        setImproving("");
        setHealthy("");
        setShow(false);
        router.refresh();
      }
    });
  }

  if (!show) {
    return (
      <button
        type="button"
        onClick={() => setShow(true)}
        className="inline-flex items-center gap-1.5 self-start rounded-full bg-amber px-4 py-2 text-[13.5px] font-semibold text-[#23170c] transition hover:bg-amber-deep max-md:min-h-[44px]"
      >
        <Plus size={15} strokeWidth={2.2} aria-hidden="true" />
        Add a test
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="grid gap-3 sm:grid-cols-2">
        <input
          className={field}
          placeholder="Test name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <select
          className={field}
          value={pillar}
          onChange={(e) => setPillar(e.target.value as PillarKey)}
        >
          {PILLAR_ORDER.map((p) => (
            <option key={p} value={p}>
              {PILLAR_LABEL[p]}
            </option>
          ))}
        </select>
        <input
          className={field}
          placeholder="Unit (reps, seconds, meters…)"
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
        />
        <select
          className={field}
          value={higher ? "higher" : "lower"}
          onChange={(e) => setHigher(e.target.value === "higher")}
        >
          <option value="higher">Higher is better</option>
          <option value="lower">Lower is better</option>
        </select>
        <select
          className={field}
          value={judgment ? "judgment" : "thresholds"}
          onChange={(e) => setJudgment(e.target.value === "judgment")}
        >
          <option value="thresholds">Banded by simple targets</option>
          <option value="judgment">Banded by my read on the day</option>
        </select>
        {!judgment ? (
          <>
            <input
              className={field}
              inputMode="decimal"
              placeholder="Improving band (optional)"
              value={improving}
              onChange={(e) => setImproving(e.target.value)}
            />
            <input
              className={field}
              inputMode="decimal"
              placeholder="Healthy band (optional)"
              value={healthy}
              onChange={(e) => setHealthy(e.target.value)}
            />
          </>
        ) : null}
      </div>
      {err ? (
        <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">
          {err}
        </p>
      ) : null}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={add}
          disabled={pending || !name.trim() || !unit.trim()}
          className="rounded-full bg-forest px-4 py-2 text-[13px] font-semibold text-bone transition hover:bg-forest-deep disabled:opacity-60 max-md:min-h-[44px]"
        >
          {pending ? "Adding" : "Add test"}
        </button>
        <button
          type="button"
          onClick={() => setShow(false)}
          className="rounded-full px-4 py-2 text-[13px] font-medium text-[color:var(--color-text-muted)] hover:text-forest max-md:min-h-[44px]"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function AssessmentCatalogEditor({ groups }: { groups: CatalogGroup[] }) {
  return (
    <div className="flex flex-col gap-6">
      <AddTest />
      {groups.map((g) => (
        <section key={g.pillar}>
          <p className="eyebrow text-bark">{g.label}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {g.tests.map((t) => (
              <TestRow key={t.id} test={t} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
