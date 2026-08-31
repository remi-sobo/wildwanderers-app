import { getMyHomework } from "@/lib/data/homework";
import { HomeworkList } from "@/components/client/HomeworkList";
import { EmptyState } from "@/components/ui/EmptyState";

// The client's Homework screen: the small things your coach sends home
// between sessions. Open items first, one tap to check off, an optional
// note back. Guarded by the (client) layout; RLS shows only your own.
export default async function HomeworkPage() {
  const items = await getMyHomework();

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="eyebrow text-bark">Homework</p>
        <h1 className="mt-1 font-[family-name:var(--font-display)] text-[26px] leading-tight text-forest-deep">
          The small things between sessions.
        </h1>
      </div>
      {items.length === 0 ? (
        <EmptyState title="No homework right now.">
          Enjoy the rest day. When your coach sends something home, it shows up
          here, ready to check off.
        </EmptyState>
      ) : (
        <HomeworkList items={items} />
      )}
    </div>
  );
}
