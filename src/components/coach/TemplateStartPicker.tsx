"use client";

import { useState, useTransition } from "react";
import { LayoutTemplate } from "lucide-react";
import { startPlanFromTemplate } from "@/lib/coach/template-actions";
import type { TemplateSummary } from "@/lib/data/templates";

// Start a client's plan from a saved template. Instantiates a resting draft
// and opens it in the builder; nothing goes live here.
export function TemplateStartPicker({
  clientId,
  templates,
}: {
  clientId: string;
  templates: TemplateSummary[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (templates.length === 0) return null;

  function start(templateId: string) {
    setError(null);
    setPendingId(templateId);
    startTransition(async () => {
      const result = await startPlanFromTemplate(clientId, templateId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="max-w-3xl rounded-2xl border border-[color:var(--border-hair)] bg-card p-6 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2">
        <LayoutTemplate size={15} className="text-forest" aria-hidden="true" />
        <p className="eyebrow text-bark">Start from a template</p>
      </div>
      <p className="mt-2 text-[13px] text-[color:var(--color-text-muted)]">
        Opens as a draft to tailor for this client. Or skip it and build from
        scratch below.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {templates.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => start(t.id)}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full border border-[color:var(--border-strong)] px-4 py-2 text-[13px] font-semibold text-forest transition-colors hover:bg-inset disabled:opacity-70 max-md:min-h-[44px]"
          >
            {pending && pendingId === t.id ? "Opening" : t.title}
            <span className="text-[11px] font-medium text-[color:var(--color-text-muted)]">
              {t.workout_count} {t.workout_count === 1 ? "workout" : "workouts"}
            </span>
          </button>
        ))}
      </div>
      {error ? (
        <p role="alert" className="mt-3 text-[13px] text-[color:var(--color-state-error)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
