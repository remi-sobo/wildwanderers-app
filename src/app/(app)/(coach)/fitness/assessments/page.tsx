import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getAssessmentCatalog } from "@/lib/data/longevity";
import { AssessmentCatalogEditor } from "@/components/coach/AssessmentCatalogEditor";

export default async function AssessmentsPage() {
  const groups = await getAssessmentCatalog();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/fitness"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-forest max-md:min-h-[44px]"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Fitness
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-[30px] leading-tight text-forest-deep">
          Assessment tests
        </h1>
        <p className="mt-1 max-w-2xl text-[14px] leading-[1.55] text-[color:var(--color-text-muted)]">
          The shared catalog behind every client&apos;s longevity profile and the
          boys&apos; earned experiences. Bands are simple starting points you set and
          tune, not medical thresholds. Edit them freely; a test with no bands
          simply shows no band until you set one.
        </p>
      </div>

      <AssessmentCatalogEditor groups={groups} />
    </div>
  );
}
