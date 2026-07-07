import Link from "next/link";
import { ChevronLeft, LayoutTemplate } from "lucide-react";
import { getPlanTemplates } from "@/lib/data/templates";
import { renameTemplate, setTemplateActive } from "@/lib/coach/template-actions";
import { EmptyState } from "@/components/ui/EmptyState";

export const metadata = { title: "Templates — Wild Wanderers" };

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// The org's saved plan templates: rename, retire, bring back. Building and
// saving one happens in the plan builder; starting from one happens on a
// client's new-plan page.
export default async function TemplatesPage() {
  const templates = await getPlanTemplates();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/program"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-forest"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Program
        </Link>
        <h1 className="mt-2 font-[family-name:var(--font-display)] text-[28px] leading-tight text-forest-deep">
          Plan templates
        </h1>
        <p className="mt-1 text-[13.5px] text-[color:var(--color-text-muted)]">
          Build a plan once, reuse it for any client. Save one from the plan
          builder; start from one on a client&apos;s new-plan page.
        </p>
      </div>

      {templates.length === 0 ? (
        <EmptyState icon={LayoutTemplate} title="Your templates gather here.">
          In the plan builder, choose Save as a template and it lands here,
          ready to start any client&apos;s next plan.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {templates.map((t) => {
            const rename = renameTemplate.bind(null, t.id);
            const setActive = setTemplateActive.bind(null, t.id, !t.is_active);
            return (
              <li
                key={t.id}
                className={`flex flex-wrap items-center gap-3 rounded-2xl border border-[color:var(--border-hair)] bg-card px-5 py-4 shadow-[var(--shadow-card)] ${
                  t.is_active ? "" : "opacity-60"
                }`}
              >
                <LayoutTemplate size={17} className="shrink-0 text-forest" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <form action={rename} className="flex items-center gap-2">
                    <input
                      name="title"
                      defaultValue={t.title}
                      aria-label="Template title"
                      className="h-9 w-full max-w-[340px] rounded-lg border border-transparent bg-transparent px-2 font-[family-name:var(--font-display)] text-[16px] text-forest-deep transition-colors hover:border-[color:var(--border-hair)] focus:border-[color:var(--border-strong)] focus:bg-card focus:outline-none"
                    />
                    <button
                      type="submit"
                      className="text-[12px] font-semibold text-[color:var(--color-text-faint)] transition-colors hover:text-forest"
                    >
                      Rename
                    </button>
                  </form>
                  <p className="px-2 text-[12.5px] text-[color:var(--color-text-muted)]">
                    {t.workout_count} {t.workout_count === 1 ? "workout" : "workouts"}
                    {t.goal ? ` · ${t.goal}` : ""} · saved {formatDay(t.created_at)}
                  </p>
                </div>
                {!t.is_active ? (
                  <span className="shrink-0 rounded-full bg-inset px-2.5 py-1 text-[11px] font-semibold text-[color:var(--color-text-muted)]">
                    Retired
                  </span>
                ) : null}
                <form action={setActive}>
                  <button
                    type="submit"
                    className="shrink-0 rounded-full border border-[color:var(--border-strong)] px-3.5 py-1.5 text-[12.5px] font-semibold text-forest transition-colors hover:bg-inset"
                  >
                    {t.is_active ? "Retire" : "Bring back"}
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
