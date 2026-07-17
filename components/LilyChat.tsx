"use client";

import { useState, useRef, useEffect } from "react";
import { LilyMark } from "@/components/Logo";
import { IconX } from "@/components/icons";

type Message = { role: "user" | "assistant"; content: string };

const GREETING: Message = {
  role: "assistant",
  content:
    "Hi — ask me about orders, transactions, or customers, e.g. “what's overdue” or “summarize Goodwill Marketing”. I only read your real data, I can't make changes.",
};

export default function LilyChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setError("");
    setInput("");
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await fetch("/api/lily-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Something went wrong");
      setMessages([...next, { role: "assistant", content: data.reply }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't reach Lily — try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Speak to Lily"
        className="no-print fixed right-6 bottom-6 z-30 flex items-center gap-2.5 pl-3 pr-4 h-14 rounded-full bg-surface border-2 border-primary text-primary-hover shadow-pop hover:-translate-y-0.5 hover:shadow-xl active:scale-95 transition-all"
      >
        <span className="h-8 w-8 rounded-full bg-gradient-to-br from-primary-light to-primary text-white grid place-items-center shrink-0">
          <LilyMark size={18} mono />
        </span>
        <span className="text-[14px] font-semibold whitespace-nowrap">Ask Lily</span>
      </button>

      {open && (
        <div className="no-print fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label="Speak to Lily">
          <div className="absolute inset-0 bg-ink/25 backdrop-blur-[2px]" onClick={() => setOpen(false)} />
          <div className="absolute right-5 top-5 bottom-5 w-full max-w-[400px] bg-surface border border-line rounded-2xl shadow-pop flex flex-col overflow-hidden">
            <div className="flex items-center gap-2.5 px-4 py-3.5 border-b border-line">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary-light to-primary text-white grid place-items-center shrink-0">
                <LilyMark size={17} mono />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-ink">Speak to Lily</div>
                <div className="text-[11px] text-profit flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-profit" /> Connected · read-only
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-faint hover:text-ink p-1.5 rounded-lg hover:bg-surface-2">
                <IconX size={17} />
              </button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  {m.role === "assistant" && (
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary-light to-primary text-white grid place-items-center shrink-0">
                      <LilyMark size={15} mono />
                    </div>
                  )}
                  <div
                    className={`rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed max-w-[88%] whitespace-pre-wrap ${
                      m.role === "user"
                        ? "bg-primary text-white rounded-tr-sm"
                        : "bg-surface-2 text-ink rounded-tl-sm"
                    }`}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary-light to-primary text-white grid place-items-center shrink-0">
                    <LilyMark size={15} mono />
                  </div>
                  <div className="bg-surface-2 rounded-xl rounded-tl-sm px-3.5 py-2.5 text-[13px] text-muted">
                    Checking…
                  </div>
                </div>
              )}
              {error && <p className="text-[12px] text-loss text-center">{error}</p>}
            </div>

            <div className="p-3 border-t border-line">
              <form
                onSubmit={(e) => { e.preventDefault(); send(); }}
                className="flex items-center gap-2 bg-surface-2 border border-line rounded-xl px-3 py-2 focus-within:border-primary"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about any order, customer, or trend…"
                  disabled={busy}
                  className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="text-[13px] font-semibold text-primary hover:text-primary-hover disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Send
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
