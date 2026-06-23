"use client";

import { useState } from "react";
import clsx from "clsx";
import { toast } from "sonner";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

const QUICK_PROMPTS = [
  "Why is this waiting?",
  "Show proof",
  "Release escrow",
];

export function ChatAssistant({
  taskId,
  onClassify,
}: {
  taskId?: string;
  onClassify?: (input: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      text: "What do you want RESOLVE to handle? I can clarify missing details or explain status.",
    },
  ]);
  const [loading, setLoading] = useState(false);

  async function send(text: string) {
    if (!text.trim()) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);

    try {
      if (!taskId && onClassify) {
        onClassify(text);
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: "Got it — reviewing your request and checking what connectors we need.",
          },
        ]);
        return;
      }

      if (taskId) {
        const res = await fetch(`/api/tasks/${taskId}`);
        const data = await res.json();
        const task = data.task;
        const reply = task
          ? `Status: ${task.status.replace(/_/g, " ")}. ${
              task.attentionReason ?? "Progress updates appear on the mission screen."
            }`
          : "Sign in and open a mission to check live status.";
        setMessages((m) => [...m, { role: "assistant", text: reply }]);
        return;
      }

      const classifyRes = await fetch("/api/tasks/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text }),
      });
      const { classification } = await classifyRes.json();
      const reply = classification.question
        ? classification.question
        : `Detected: ${classification.category.replace(/_/g, " ")}${
            classification.company ? ` for ${classification.company}` : ""
          }. Ready to create mission when you confirm.`;
      setMessages((m) => [...m, { role: "assistant", text: reply }]);
    } catch {
      toast.error("Could not process message");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-12 w-12 items-center justify-center rounded-full border border-sky-500/30 bg-sky-500/20 text-sm font-medium text-white shadow-[0_0_24px_-4px_rgba(56,189,248,0.5)] backdrop-blur-md hover:bg-sky-500/30"
        aria-label="Open assistant"
      >
        Ask
      </button>

      {open && (
        <div className="fixed bottom-20 right-6 z-40 flex h-[420px] w-[360px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-resolve-surface/95 shadow-2xl backdrop-blur-xl">
          <header className="border-b border-white/[0.06] px-4 py-3">
            <p className="font-semibold text-white">RESOLVE Assistant</p>
            <p className="text-xs text-resolve-muted">Clarify tasks and check status</p>
          </header>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={clsx(
                  "max-w-[90%] rounded-xl px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "ml-auto bg-sky-500/20 text-white"
                    : "bg-black/30 text-white/90"
                )}
              >
                {msg.text}
              </div>
            ))}
          </div>

          <div className="border-t border-white/[0.06] p-2">
            <div className="mb-2 flex flex-wrap gap-1">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-resolve-muted hover:text-white"
                >
                  {p}
                </button>
              ))}
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void send(input);
              }}
              className="flex gap-2"
            >
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask or assign…"
                className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-sky-500/40"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-sky-500 px-3 py-2 text-sm font-medium text-white hover:bg-sky-400 disabled:opacity-50"
              >
                Send
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
