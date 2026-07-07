import { getMyTraining } from "@/lib/data/training";
import { ClientTraining } from "@/components/client/ClientTraining";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function TrainingPage() {
  const { plan, completedIds } = await getMyTraining();

  if (!plan || plan.workouts.length === 0) {
    return (
      <EmptyState title="Your workouts land here.">
        When your coach sets up your plan, each workout shows up with everything you
        need for the day. Check back soon.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="eyebrow text-bark">Your plan</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[26px] leading-tight text-forest-deep">
          {plan.title}
        </h1>
      </div>
      <ClientTraining plan={plan} completedIds={completedIds} />
    </div>
  );
}
