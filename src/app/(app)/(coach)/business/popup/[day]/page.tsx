import { notFound } from "next/navigation";
import { getRollCall } from "@/lib/data/popup";
import { RollCall } from "@/components/coach/RollCall";

// Roll call for one pop-up day. Owner-only through the Business layout.
export default async function PopupDayPage({ params }: { params: Promise<{ day: string }> }) {
  const { day } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(day)) notFound();
  const data = await getRollCall(day);
  if (!data) notFound();
  return <RollCall data={data} />;
}
