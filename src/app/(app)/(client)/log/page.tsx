import { getTrackingHub } from "@/lib/data/wellness";
import { getMyCheckIns } from "@/lib/data/checkins";
import { getMyOrg } from "@/lib/data/org";
import { voiceConfigured } from "@/lib/voice/transcribe";
import { ConsentScreen } from "@/components/client/ConsentScreen";
import { LogHub } from "@/components/client/LogHub";

export default async function LogPage() {
  const [hub, org] = await Promise.all([getTrackingHub(), getMyOrg()]);

  if (!hub.hasConsent) {
    return <ConsentScreen orgName={org?.name} />;
  }

  const recentCheckIns = await getMyCheckIns();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="eyebrow text-bark">Your log</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[26px] leading-tight text-forest-deep">
          Log what you did.
        </h1>
        <p className="mt-1 text-[14px] text-[color:var(--color-text-muted)]">
          Everything here stays private to you and your coach.
        </p>
      </div>
      <LogHub
        habits={hub.habits}
        latestMeasurement={hub.latestMeasurement}
        recentActivity={hub.recentActivity}
        todaysFood={hub.todaysFood}
        todaysCalories={hub.todaysCalories}
        recentCheckIns={recentCheckIns}
        voiceEnabled={voiceConfigured()}
      />
    </div>
  );
}
