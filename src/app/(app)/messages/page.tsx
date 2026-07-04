import Link from "next/link";
import { ChevronLeft, MessageCircle } from "lucide-react";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { getThreads, getMessages } from "@/lib/data/messages";
import { Conversation } from "@/components/messaging/Conversation";
import { EmptyState } from "@/components/ui/EmptyState";

export const dynamic = "force-dynamic";

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t } = await searchParams;
  const session = await getSessionProfile();
  const isStaff =
    session?.profile?.role === "owner" || session?.profile?.role === "coach";

  const threads = await getThreads();

  if (threads.length === 0) {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <EmptyState icon={MessageCircle} title={isStaff ? "No conversations yet." : "Talk with your coach here."}>
          {isStaff
            ? "Open a conversation from a client's page and it shows up here."
            : "Your messages with your coach will live on this screen. They will reach out soon."}
        </EmptyState>
      </div>
    );
  }

  const selectedId = t ?? threads[0]?.id ?? null;
  const selected = threads.find((th) => th.id === selectedId) ?? null;
  const messages = selected ? await getMessages(selected.id) : [];

  return (
    <div className="flex h-[72dvh] overflow-hidden rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)]">
      <aside
        className={`w-full overflow-y-auto border-[color:var(--border-hair)] md:w-72 md:shrink-0 md:border-r ${
          selected ? "hidden md:block" : "block"
        }`}
      >
        <p className="eyebrow border-b border-[color:var(--border-hair)] px-5 py-4 text-bark">
          Conversations
        </p>
        <ul>
          {threads.map((th) => (
            <li key={th.id}>
              <Link
                href={`/messages?t=${th.id}`}
                className={`block border-b border-[color:var(--border-hair)] px-5 py-3.5 transition-colors hover:bg-inset ${
                  th.id === selectedId ? "bg-inset" : ""
                }`}
              >
                <p className="font-[family-name:var(--font-display)] text-[15px] text-forest-deep">
                  {th.other_name}
                </p>
                <p className="truncate text-[12.5px] text-[color:var(--color-text-muted)]">
                  {th.last_message_preview ?? "No messages yet"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </aside>

      <section className={`min-w-0 flex-1 ${selected ? "flex" : "hidden md:flex"} flex-col`}>
        {selected && session ? (
          <>
            <Link
              href="/messages"
              className="flex items-center gap-1 border-b border-[color:var(--border-hair)] px-4 py-2 text-[13px] font-medium text-[color:var(--color-text-muted)] md:hidden"
            >
              <ChevronLeft size={16} /> Conversations
            </Link>
            <Conversation
              key={selected.id}
              threadId={selected.id}
              currentUserId={session.userId}
              otherName={selected.other_name}
              initialMessages={messages}
            />
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-[13.5px] text-[color:var(--color-text-muted)]">
            Pick a conversation to open it.
          </div>
        )}
      </section>
    </div>
  );
}
