import { getTrailheadData } from "@/lib/data/trailhead";
import { EmptyState } from "@/components/ui/EmptyState";
import { TrailheadFeed } from "@/components/library/TrailheadFeed";
import { Ridgeline } from "@/components/brand/Ridgeline";

// The shared Trailhead Library reader, in the app shell. Any signed-in member
// reaches it: fitness clients and boys-program families alike. RLS decides what
// each viewer sees; a client can mark the weekly challenge done. This is the
// (app)-level surface, guarded only by the shell's requireUser, so it is not
// role-locked to the coach or client sub-shells.
export default async function TrailheadPage() {
  const { posts, challenge, completedPostIds, canComplete } = await getTrailheadData();

  // The featured challenge does not repeat in the grid below it.
  const gridPosts = challenge ? posts.filter((p) => p.id !== challenge.id) : posts;
  const challengeDone = challenge ? completedPostIds.includes(challenge.id) : false;

  return (
    <div className="flex flex-col gap-6">
      {/* A short bit of scenery to crown the header, then clean content below. */}
      <div className="relative overflow-hidden rounded-2xl bg-chrome px-6 py-7">
        <Ridgeline className="pointer-events-none absolute inset-x-0 bottom-0 text-mist/10" />
        <div className="relative z-10">
          <p className="eyebrow text-bone/55">Trailhead Library</p>
          <h1 className="mt-1.5 font-[family-name:var(--font-display)] text-[26px] leading-tight text-bone">
            Notes from the trail
          </h1>
          <p className="mt-1.5 max-w-md text-[14px] leading-[1.5] text-bone/80">
            Short reads, links, and the weekly challenge. New notes land as Gabe posts them.
          </p>
        </div>
      </div>

      {posts.length === 0 ? (
        <EmptyState title="The first notes are on the way">
          The Trailhead Library is where Gabe shares reads, links, and a weekly challenge.
          Check back soon, the first ones post here.
        </EmptyState>
      ) : (
        <TrailheadFeed
          posts={gridPosts}
          challenge={challenge}
          challengeDone={challengeDone}
          canComplete={canComplete}
        />
      )}
    </div>
  );
}
