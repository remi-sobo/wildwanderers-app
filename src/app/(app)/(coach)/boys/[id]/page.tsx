import Link from "next/link";
import { ChevronLeft } from "lucide-react";

export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await params;
  return (
    <div className="flex flex-col gap-4">
      <Link href="/boys" className="inline-flex items-center gap-1 text-[13px] font-medium text-[color:var(--color-text-muted)] transition-colors hover:text-forest">
        <ChevronLeft size={16} aria-hidden="true" /> Dads &amp; Kids
      </Link>
      <p className="text-[14px] text-[color:var(--color-text-muted)]">Roster, schedule, and attendance are being built in this ring.</p>
    </div>
  );
}
