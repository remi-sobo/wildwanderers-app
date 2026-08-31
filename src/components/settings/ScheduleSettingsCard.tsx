"use client";

// The Schedule card on /settings: grid hours, travel buffer, defaults
// for new blocks, and the block colors, each saved the moment it
// changes. Staff only; the card never renders for a client or family.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveScheduleSettings, type ScheduleSettingsInput } from "@/lib/schedule/actions";
import { BLOCK_TYPES, BLOCK_PALETTE, typeColor, formatMinutes } from "@/lib/schedule/blocks";
import type { ScheduleSettings } from "@/lib/data/schedule";

const selectCls =
  "h-10 w-[130px] rounded-[10px] border border-[color:var(--border-strong)] bg-card px-2 text-[13px] text-ink";

function Row({
  label,
  helper,
  children,
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-[color:var(--border-hair)] py-3 first:border-t-0">
      <div className="min-w-0">
        <p className="text-[14px] text-forest-deep">{label}</p>
        {helper ? (
          <p className="text-[12px] text-[color:var(--color-text-muted)]">{helper}</p>
        ) : null}
      </div>
      {children}
    </div>
  );
}

export function ScheduleSettingsCard({ settings }: { settings: ScheduleSettings }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [local, setLocal] = useState(settings);

  function save(patch: ScheduleSettingsInput) {
    setError(null);
    setLocal((s) => ({ ...s, ...patch }) as ScheduleSettings);
    start(async () => {
      const res = await saveScheduleSettings(patch);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  const startOptions = [5, 6, 7, 8, 9, 10];
  const endOptions: number[] = [];
  for (let h = 16; h <= 23.5; h += 0.5) endOptions.push(h);

  return (
    <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">Schedule</p>
      <h2 className="mt-1 font-[family-name:var(--font-display)] text-[20px] text-forest-deep">
        How your week is drawn
      </h2>
      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">{error}</p>
      ) : null}

      <div className="mt-3">
        <Row label="Day starts">
          <select
            className={selectCls}
            aria-label="Day starts"
            disabled={pending}
            value={local.start_hour}
            onChange={(e) => save({ start_hour: Number(e.target.value) })}
          >
            {startOptions.map((h) => (
              <option key={h} value={h}>{formatMinutes(h * 60, true)}</option>
            ))}
          </select>
        </Row>
        <Row label="Day ends">
          <select
            className={selectCls}
            aria-label="Day ends"
            disabled={pending}
            value={local.end_hour}
            onChange={(e) => save({ end_hour: Number(e.target.value) })}
          >
            {endOptions.map((h) => (
              <option key={h} value={h}>{formatMinutes(h * 60, true)}</option>
            ))}
          </select>
        </Row>
        <Row
          label="Travel buffer"
          helper="Suggested after each session, you confirm before it lands"
        >
          <select
            className={selectCls}
            aria-label="Travel buffer"
            disabled={pending}
            value={local.travel_buffer_min}
            onChange={(e) => save({ travel_buffer_min: Number(e.target.value) })}
          >
            <option value={0}>None</option>
            <option value={15}>15 min</option>
            <option value={30}>30 min</option>
            <option value={45}>45 min</option>
          </select>
        </Row>
        <Row label="New blocks start at">
          <select
            className={selectCls}
            aria-label="New block length"
            disabled={pending}
            value={local.default_len_min}
            onChange={(e) => save({ default_len_min: Number(e.target.value) })}
          >
            {[30, 45, 60, 90].map((m) => (
              <option key={m} value={m}>{m} min</option>
            ))}
          </select>
        </Row>
        <Row label="New blocks are">
          <select
            className={selectCls}
            aria-label="New block type"
            disabled={pending}
            value={local.default_block_type}
            onChange={(e) => save({ default_block_type: e.target.value })}
          >
            {BLOCK_TYPES.map((t) => (
              <option key={t.key} value={t.key}>{t.label}</option>
            ))}
          </select>
        </Row>

        {/* Block colors */}
        <div className="border-t border-[color:var(--border-hair)] pt-3">
          <p className="text-[14px] text-forest-deep">Block colors</p>
          <div className="mt-2 flex flex-col gap-2">
            {BLOCK_TYPES.map((t) => {
              const active = typeColor(t.key, local.colors);
              return (
                <div key={t.key} className="flex items-center justify-between gap-3">
                  <span className="text-[13px] text-[color:var(--color-text)]">{t.label}</span>
                  <div className="flex gap-1.5">
                    {BLOCK_PALETTE.map((c) => (
                      <button
                        key={c}
                        type="button"
                        disabled={pending}
                        aria-label={`${t.label} color ${c}`}
                        aria-pressed={active === c}
                        onClick={() => save({ colors: { ...local.colors, [t.key]: c } })}
                        className="h-6 w-6 rounded-full border border-[color:var(--border-hair)]"
                        style={{
                          background: c,
                          outline: active === c ? "2px solid #d98a3a" : "none",
                          outlineOffset: 2,
                        }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
