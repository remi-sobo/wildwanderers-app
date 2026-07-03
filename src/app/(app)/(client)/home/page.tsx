import { CalendarDays } from "lucide-react";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { Ridgeline } from "@/components/brand/Ridgeline";
import { EmptyState } from "@/components/ui/EmptyState";

export default async function ClientHomePage() {
  const session = await getSessionProfile();
  const firstName = session?.profile?.first_name?.trim();

  return (
    <div className="flex flex-col gap-6">
      <section className="relative overflow-hidden rounded-2xl bg-chrome shadow-[var(--shadow-card)]">
        <Ridgeline className="absolute inset-x-0 bottom-0 h-20 w-full" />
        <div className="relative z-10 px-6 pb-10 pt-7">
          <p className="eyebrow text-[10px] text-bone/60">Wild Wanderers</p>
          <h1 className="mt-2 font-[family-name:var(--font-display)] text-[26px] leading-tight text-bone">
            {firstName ? `Good to see you, ${firstName}.` : "Good to see you."}
          </h1>
        </div>
      </section>

      <EmptyState icon={CalendarDays} title="Your day starts here.">
        Once Gabe sets up your plan, today's workout and your next session show up
        on this screen. Nothing to do yet, and that is fine.
      </EmptyState>
    </div>
  );
}
