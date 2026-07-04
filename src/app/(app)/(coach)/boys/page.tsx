import { getPrograms } from "@/lib/data/boys";
import { ProgramsList } from "@/components/coach/ProgramsList";

export default async function BoysPage() {
  const programs = await getPrograms();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="eyebrow text-bark">Dads &amp; Kids</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[26px] leading-tight text-forest-deep">
          The boys program.
        </h1>
      </div>
      <ProgramsList programs={programs} />
    </div>
  );
}
