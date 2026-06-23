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
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-xl shadow-lg shadow-blue-900/40 hover:bg-blue-500"
        aria-label="Open assistant"
      >
        💬
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 z-40 flex h-[420px] w-[360px] flex-col overflow-hidden rounded-2xl border border-deputy-border bg-deputy-panel shadow-2xl">
          <header className="border-b border-deputy-border px-4 py-3">
            <p className="font-semibold">RESOLVE Assistant</p>
            <p className="text-xs text-deputy-muted">Command & clarification</p>
          </header>

          <div className="flex-1 space-y-2 overflow-y-auto p-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={clsx(
                  "max-w-[90%] rounded-xl px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "ml-auto bg-blue-600/30 text-white"
                    : "bg-deputy-bg text-white/90"
                )}
              >
                {msg.text}
              </div>
            ))}
          </div>

          <div className="border-t border-deputy-border p-2">
            <div className="mb-2 flex flex-wrap gap-1">
              {QUICK_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => send(p)}
                  className="rounded-full border border-deputy-border px-2 py-0.5 text-[10px] text-deputy-muted hover:text-white"
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
                className="flex-1 rounded-lg border border-deputy-border bg-deputy-bg px-3 py-2 text-sm outline-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium disabled:opacity-50"
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
