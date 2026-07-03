"use client";

import { useState, useTransition } from "react";
import { Search, Plus, X, Check } from "lucide-react";
import { searchFoods, logFood, deleteFoodLog } from "@/lib/wellness/food-actions";
import type { FoodCandidate } from "@/lib/nutrition/types";
import type { FoodLog } from "@/lib/data/wellness";

const MEALS = ["breakfast", "lunch", "dinner", "snack"] as const;
type Meal = (typeof MEALS)[number];

function macroLine(c: FoodCandidate): string {
  const parts: string[] = [];
  if (c.calories != null) parts.push(`${c.calories} kcal`);
  if (c.protein_g != null) parts.push(`${c.protein_g}p`);
  if (c.carb_g != null) parts.push(`${c.carb_g}c`);
  if (c.fat_g != null) parts.push(`${c.fat_g}f`);
  return parts.join(" · ");
}

export function FoodCard({
  todaysFood,
  todaysCalories,
}: {
  todaysFood: FoodLog[];
  todaysCalories: number;
}) {
  const [meal, setMeal] = useState<Meal>("breakfast");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodCandidate[]>([]);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [logging, startLog] = useTransition();
  const [picked, setPicked] = useState<FoodCandidate | null>(null);
  const [qty, setQty] = useState("1");

  function runSearch() {
    if (query.trim().length < 2) return;
    setError(null);
    setPicked(null);
    startSearch(async () => {
      const res = await searchFoods(query);
      if (res.error) setError(res.error);
      setResults(res.candidates);
      setSearched(true);
    });
  }

  function confirmLog() {
    if (!picked) return;
    setError(null);
    startLog(async () => {
      const res = await logFood({ candidate: picked, meal, quantity: qty });
      if (res.error) setError(res.error);
      else {
        setPicked(null);
        setQuery("");
        setResults([]);
        setSearched(false);
        setQty("1");
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {MEALS.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMeal(m)}
            className={`rounded-full border px-3.5 py-1.5 text-[13px] capitalize transition-colors ${
              meal === m
                ? "border-forest bg-forest text-bone"
                : "border-[color:var(--border-strong)] bg-canvas text-[color:var(--color-text)] hover:border-forest"
            }`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--color-text-faint)]"
            aria-hidden="true"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                runSearch();
              }
            }}
            placeholder="Search a food, e.g. banana"
            className="h-11 w-full rounded-xl border border-[color:var(--border-strong)] bg-canvas pl-9 pr-3 text-[15px] text-ink"
          />
        </div>
        <button
          type="button"
          onClick={runSearch}
          disabled={searching || query.trim().length < 2}
          className="shrink-0 rounded-xl bg-forest px-4 text-[14px] font-semibold text-bone transition-colors hover:bg-forest-deep disabled:opacity-60"
        >
          {searching ? "…" : "Search"}
        </button>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-[13px] text-[color:var(--color-state-error)]">
          {error}
        </p>
      ) : null}

      {searched && !searching && results.length === 0 ? (
        <p className="mt-3 text-[13.5px] text-[color:var(--color-text-muted)]">
          No matches. Try a simpler word.
        </p>
      ) : null}

      {results.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-1.5">
          {results.map((c) => {
            const isPicked =
              picked?.source === c.source && picked?.external_id === c.external_id;
            return (
              <li key={`${c.source}-${c.external_id}`}>
                <button
                  type="button"
                  onClick={() => setPicked(isPicked ? null : c)}
                  className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                    isPicked
                      ? "border-forest bg-forest/5"
                      : "border-[color:var(--border-hair)] bg-canvas hover:border-[color:var(--border-strong)]"
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] text-forest-deep">
                      {c.name}
                      {c.brand ? (
                        <span className="text-[color:var(--color-text-faint)]"> · {c.brand}</span>
                      ) : null}
                    </span>
                    <span className="block text-[12px] text-[color:var(--color-text-muted)]">
                      {macroLine(c) || "macros unavailable"} · {c.serving}
                    </span>
                  </span>
                  {isPicked ? (
                    <Check size={16} className="shrink-0 text-forest" aria-hidden="true" />
                  ) : (
                    <Plus
                      size={16}
                      className="shrink-0 text-[color:var(--color-text-faint)]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      {picked ? (
        <div className="mt-3 flex items-center gap-3 rounded-xl border border-[color:var(--border-hair)] bg-inset/40 px-4 py-3">
          <label className="flex items-center gap-2">
            <span className="text-[13px] text-[color:var(--color-text-muted)]">Servings</span>
            <input
              type="number"
              inputMode="decimal"
              min="0.1"
              step="0.5"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className="h-10 w-20 rounded-lg border border-[color:var(--border-strong)] bg-canvas px-2 text-[15px] text-ink"
            />
          </label>
          <button
            type="button"
            onClick={confirmLog}
            disabled={logging}
            className="ml-auto rounded-full bg-amber px-5 py-2.5 text-[14px] font-semibold text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-80"
          >
            {logging ? "Logging" : "Log food"}
          </button>
        </div>
      ) : null}

      {todaysFood.length > 0 ? (
        <div className="mt-5 border-t border-[color:var(--border-hair)] pt-4">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-[12px] font-semibold uppercase tracking-[0.12em] text-bark">
              Today
            </span>
            <span className="font-[family-name:var(--font-display)] text-[15px] text-forest-deep">
              {todaysCalories} kcal
            </span>
          </div>
          <ul className="flex flex-col gap-1">
            {todaysFood.map((f) => (
              <FoodRow key={f.id} food={f} />
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}

function FoodRow({ food }: { food: FoodLog }) {
  const [removed, setRemoved] = useState(false);
  const [, startTransition] = useTransition();
  if (removed) return null;
  return (
    <li className="flex items-center gap-2 text-[13px]">
      <span className="w-16 shrink-0 text-[11px] capitalize text-[color:var(--color-text-faint)]">
        {food.meal}
      </span>
      <span className="min-w-0 flex-1 truncate text-[color:var(--color-text)]">
        {food.description}
        {food.quantity !== 1 ? (
          <span className="text-[color:var(--color-text-faint)]"> ×{food.quantity}</span>
        ) : null}
      </span>
      <span className="shrink-0 text-[color:var(--color-text-muted)]">
        {food.calories != null ? `${Math.round(food.calories)} kcal` : ""}
      </span>
      <button
        type="button"
        aria-label="Remove"
        onClick={() => {
          setRemoved(true);
          startTransition(async () => {
            const res = await deleteFoodLog(food.id);
            if (res.error) setRemoved(false);
          });
        }}
        className="shrink-0 text-[color:var(--color-text-faint)] transition-colors hover:text-[color:var(--color-state-error)]"
      >
        <X size={14} aria-hidden="true" />
      </button>
    </li>
  );
}
