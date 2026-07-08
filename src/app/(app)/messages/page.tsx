import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getSessionProfile } from "@/lib/auth/get-profile";
import { getThreads, getMessages } from "@/lib/data/messages";
import { Conversation } from "@/components/messaging/Conversation";
import { NewMessage } from "@/components/messaging/NewMessage";
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
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
        <EmptyState title={isStaff ? "No conversations yet." : "Talk with your coach here."}>
          {isStaff
            ? "Start one below, or open a conversation from a client's page."
            : "Start the conversation whenever you like; your coach reads it here too."}
        </EmptyState>
        <div className="flex justify-center">
          <NewMessage isStaff={isStaff} />
        </div>
      </div>
    );
  }

  const selectedId = t ?? threads[0]?.id ?? null;
  const selected = threads.find((th) => th.id === selectedId) ?? null;
  const messages = selected ? await getMessages(selected.id) : [];

  return (
    <div className="flex flex-col gap-4">
      <NewMessage isStaff={isStaff} />
      {/* On phones the card sizes to what is left above the tab bar, so the
          composer stays reachable when the keyboard is up. */}
      <div className="flex h-[calc(100dvh-296px)] min-h-[320px] overflow-hidden rounded-2xl border border-[color:var(--border-hair)] bg-card shadow-[var(--shadow-card)] md:h-[72dvh]">
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
              className="flex min-h-[44px] items-center gap-1 border-b border-[color:var(--border-hair)] px-4 py-2 text-[13px] font-medium text-[color:var(--color-text-muted)] md:hidden"
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
    </div>
  );
}
