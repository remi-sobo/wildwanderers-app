"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { SendHorizontal } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { sendMessage, markThreadRead } from "@/lib/messaging/actions";
import type { Message } from "@/lib/data/messages";

export function Conversation({
  threadId,
  currentUserId,
  otherName,
  initialMessages,
}: {
  threadId: string;
  currentUserId: string;
  otherName: string;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const bottomRef = useRef<HTMLDivElement>(null);

  function addMessage(m: Message) {
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  }

  // Realtime: new messages on this thread arrive live for both parties.
  useEffect(() => {
    setMessages(initialMessages);
    const supabase = createClient();
    const channel = supabase
      .channel(`messages:${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `thread_id=eq.${threadId}` },
        (payload) => addMessage(payload.new as Message),
      )
      .subscribe();

    void markThreadRead(threadId);

    return () => {
      void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function onSend() {
    const value = text.trim();
    if (!value || pending) return;
    setText("");
    startTransition(async () => {
      const result = await sendMessage(threadId, value);
      if (result.message) addMessage(result.message);
      else if (result.error) setText(value);
    });
  }

  return (
    <div className="flex h-full min-h-[420px] flex-col">
      <div className="border-b border-[color:var(--border-hair)] px-5 py-4">
        <p className="font-[family-name:var(--font-display)] text-[18px] text-forest-deep">
          {otherName}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 ? (
          <p className="mt-8 text-center text-[13.5px] text-[color:var(--color-text-muted)]">
            No messages yet. Say hello.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {messages.map((m) => {
              const mine = m.sender_id === currentUserId;
              return (
                <li key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                  <span
                    className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-[14px] leading-[1.45] ${
                      mine
                        ? "rounded-br-md bg-forest text-bone"
                        : "rounded-bl-md bg-inset text-[color:var(--color-text)]"
                    }`}
                  >
                    {m.content}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-[color:var(--border-hair)] p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={1}
            placeholder="Write a message"
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-[color:var(--border-strong)] bg-card px-3.5 py-2.5 text-[14px] text-ink"
          />
          <button
            type="button"
            onClick={onSend}
            disabled={pending || !text.trim()}
            aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber text-[#23170c] transition-colors hover:bg-amber-deep disabled:opacity-40"
          >
            <SendHorizontal size={18} strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
