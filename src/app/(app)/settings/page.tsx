import { getSessionProfile } from "@/lib/auth/get-profile";
import { getMyOrg, getOrgCoaches, type Org, type OrgCoach } from "@/lib/data/org";
import { OrgSettings } from "@/components/settings/OrgSettings";

export default async function SettingsPage() {
  const session = await getSessionProfile();
  const name =
    [session?.profile?.first_name, session?.profile?.last_name].filter(Boolean).join(" ").trim() || "You";
  const isOwner = session?.profile?.role === "owner";

  const [org, coaches]: [Org | null, OrgCoach[]] = isOwner
    ? await Promise.all([getMyOrg(), getOrgCoaches()])
    : [null, []];

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div>
        <p className="eyebrow text-bark">Settings</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[26px] leading-tight text-forest-deep">
          Your workspace.
        </h1>
      </div>

      <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card p-5 shadow-[var(--shadow-card)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">Account</p>
        <p className="mt-2 text-[15px] text-forest-deep">{name}</p>
        <p className="text-[13px] text-[color:var(--color-text-muted)]">
          {session?.email ?? ""}
          {session?.profile?.role ? <span className="capitalize"> · {session.profile.role}</span> : null}
        </p>
      </section>

      {isOwner && org ? <OrgSettings org={org} coaches={coaches} /> : null}
    </div>
  );
}
