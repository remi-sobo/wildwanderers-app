import { notFound } from "next/navigation";
import { getProgram } from "@/lib/data/boys";
import { ProgramDetail } from "@/components/coach/ProgramDetail";

export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const detail = await getProgram(id);
  if (!detail) notFound();
  return <ProgramDetail detail={detail} />;
}
