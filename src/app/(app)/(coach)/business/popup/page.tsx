import Link from "next/link";
import { getSubscribers, type SubscriberSource } from "@/lib/data/business";
import { getPopupDays } from "@/lib/data/popup";
import { PopupDaysPanel } from "@/components/coach/PopupDaysPanel";

const LISTS: { source: SubscriberSource; label: string; href: string; noun: string }[] = [
  { source: "saturday", label: "Pop-up list", href: "/business/popup", noun: "on the pop-up list" },
  { source: "trailhead", label: "Library list", href: "/business/popup?list=library", noun: "on the library list" },
];

const TABS = [
  { key: "popup", label: "Pop-up list", href: "/business/popup" },
  { key: "library", label: "Library list", href: "/business/popup?list=library" },
  { key: "days", label: "Pop-up days", href: "/business/popup?list=days" },
];

// The pop-up list. Who signed up at the Saturday pop-up, newest first, with
// the library signups one tab over, and the pop-up days (roll call) beside
// them. The lists are read-only; the roll is taken on a day's page.
export default async function PopupListPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string }>;
}) {
  const { list } = await searchParams;
  const tab = list === "library" || list === "days" ? list : "popup";

  const tabs = (
    <div className="flex gap-1.5 overflow-x-auto">
      {TABS.map((l) => {
        const active = l.key === tab;
        return (
          <Link
            key={l.key}
            href={l.href}
            className={`inline-flex shrink-0 items-center rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition-colors max-md:min-h-[44px] ${
              active ? "bg-inset text-forest" : "text-[color:var(--color-text-muted)] hover:text-forest"
            }`}
          >
            {l.label}
          </Link>
        );
      })}
    </div>
  );

  if (tab === "days") {
    const days = await getPopupDays();
    return (
      <div className="flex flex-col gap-5">
        {tabs}
        <PopupDaysPanel days={days} />
      </div>
    );
  }

  const current = tab === "library" ? LISTS[1] : LISTS[0];
  const subscribers = await getSubscribers(current.source);
  const count = subscribers.length;

  return (
    <div className="flex flex-col gap-5">
      {tabs}

      <section className="rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
        <div className="border-b border-[color:var(--border-hair)] px-5 py-4">
          <p className="font-[family-name:var(--font-display)] text-[22px] leading-tight text-forest-deep">
            {count} {count === 1 ? "person" : "people"} {current.noun}
          </p>
        </div>
        <div className="p-5">
          {count === 0 ? (
            <p className="text-[13.5px] text-[color:var(--color-text-muted)]">No signups here yet.</p>
          ) : (
            <ul className="flex flex-col divide-y divide-[color:var(--border-hair)]">
              <li className="flex items-center justify-between gap-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-bark">
                <span>Name and email</span>
                <span>Signed up</span>
              </li>
              {subscribers.map((s) => (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                  <span className="min-w-0 truncate text-[color:var(--color-text)]">
                    {s.name ? <span className="text-forest-deep">{s.name} · </span> : null}
                    {s.email}
                  </span>
                  <span className="shrink-0 text-[color:var(--color-text-muted)]">
                    {new Date(s.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
