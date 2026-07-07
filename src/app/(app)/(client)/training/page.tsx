import { Dumbbell } from "lucide-react";
import { getMyTraining, getMyWorkouts } from "@/lib/data/training";
import { getPlanConversation } from "@/lib/data/plan-talk";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { ClientTraining } from "@/components/client/ClientTraining";
import { MyWorkouts, type WorkoutTalk } from "@/components/client/MyWorkouts";
import { PlanTalk } from "@/components/plans/PlanTalk";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function TrainingPage() {
  const [{ plan, completedIds }, mine, session] = await Promise.all([
    getMyTraining(),
    getMyWorkouts(),
    getSessionProfile(),
  ]);

  // Comments and swap suggestions on the plan and the client's own workouts.
  const talkPlanIds = [
    ...(plan ? [plan.id] : []),
    ...mine.workouts.map((w) => w.planId),
  ];
  const talk = await getPlanConversation(talkPlanIds);
  const viewerId = session?.userId ?? "";
  const exerciseTitles: Record<string, string> = {};
  for (const w of plan?.workouts ?? []) {
    for (const ex of w.exercises) exerciseTitles[ex.id] = ex.title;
  }
  const myTalk: Record<string, WorkoutTalk> = {};
  for (const w of mine.workouts) {
    myTalk[w.planId] = {
      comments: talk.commentsByPlan.get(w.planId) ?? [],
      swaps: talk.swapsByPlan.get(w.planId) ?? [],
    };
  }

  return (
    <div className="flex flex-col gap-8">
      {!plan || plan.workouts.length === 0 ? (
        <EmptyState icon={Dumbbell} title="Your workouts land here.">
          When your coach sets up your plan, each workout shows up with everything
          you need for the day. Check back soon.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-5">
          <div>
            <p className="eyebrow text-bark">Your plan</p>
            <h1 className="mt-1 font-[family-name:var(--font-display)] text-[26px] leading-tight text-forest-deep">
              {plan.title}
            </h1>
          </div>
          <ClientTraining plan={plan} completedIds={completedIds} />
          <PlanTalk
            planId={plan.id}
            comments={talk.commentsByPlan.get(plan.id) ?? []}
            swaps={talk.swapsByPlan.get(plan.id) ?? []}
            viewerId={viewerId}
            viewerIsStaff={false}
            otherLabel="Your coach"
            exerciseTitles={exerciseTitles}
            revalidate="/training"
          />
        </div>
      )}

      {/* The client's own lane, beside the coach's plan. */}
      <MyWorkouts
        workouts={mine.workouts}
        completedIds={mine.completedIds}
        talk={myTalk}
        viewerId={viewerId}
      />
    </div>
  );
}
