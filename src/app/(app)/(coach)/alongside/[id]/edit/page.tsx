import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getShare } from "@/lib/data/coach-shares";
import { ShareComposer, type ShareInitial } from "@/components/coach/ShareComposer";
import { coachConfigured } from "@/lib/ai/config";

export default async function EditSharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = await getShare(id);
  if (!s) notFound();

  const initial: ShareInitial = {
    id: s.id,
    tone: s.tone,
    title: s.title ?? "",
    body: s.body,
    trainingNote: s.training_note ?? "",
    audience: s.audience,
    mediaUrl: s.media_url,
    status: s.status,
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/alongside"
          className="inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-forest max-md:min-h-[44px]"
        >
          <ChevronLeft size={16} aria-hidden="true" />
          Alongside
        </Link>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-[28px] leading-tight text-forest-deep">
          Edit note
        </h1>
      </div>
      <ShareComposer mode="edit" initial={initial} coachConfigured={coachConfigured()} />
    </div>
  );
}
