import Link from "next/link";
import { Footprints, ChevronRight } from "lucide-react";
import { getMyFamily } from "@/lib/data/family";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { getMyOrg } from "@/lib/data/org";
import { getLatestCoachShare } from "@/lib/data/coach-shares";
import { FamilyView } from "@/components/family/FamilyView";

export default async function FamilyPage() {
  const [children, session, org, latestShare] = await Promise.all([
    getMyFamily(),
    getSessionProfile(),
    getMyOrg(),
    getLatestCoachShare(),
  ]);
  return (
    <div className="flex flex-col gap-6">
      {latestShare ? (
        <Link
          href="/from-your-coach"
          className="group flex items-center gap-3 rounded-2xl border border-[color:var(--border-hair)] bg-card px-5 py-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:border-[color:var(--border-strong)]"
        >
          <Footprints size={18} className="shrink-0 text-forest" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">
              From your coach
            </p>
            <p className="truncate text-[14px] text-forest-deep">
              {latestShare.title || latestShare.body}
            </p>
          </div>
          <ChevronRight
            size={16}
            className="shrink-0 text-[color:var(--color-text-faint)] transition-colors group-hover:text-forest"
          />
        </Link>
      ) : null}
      <FamilyView
        children={children}
        firstName={session?.profile?.first_name?.trim() || undefined}
        orgName={org?.name}
      />
    </div>
  );
}
