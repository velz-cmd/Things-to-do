"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Paperclip, Send, Loader2 } from "lucide-react";
import clsx from "clsx";
import { useCommand } from "@/components/resolve/command/command-context";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import { useSignInModal } from "@/components/auth/sign-in-context";
import { toast } from "sonner";

const EXAMPLES = [
  "Cancel my Adobe subscription",
  "Find refunds in my inbox",
  "Claim compensation for my delayed flight",
  "Scan this wallet for risks",
  "Recover a parcel claim",
];

export function FloatingCommandBar() {
  const pathname = usePathname();
  const show = pathname === "/" || pathname === "/start";
  const {
    draft,
    setDraft,
    registerFocus,
    submitFromHome,
    focusBar,
    submitOnStart,
    submitLoading,
    activeTaskId,
  } = useCommand();
  const { ready } = useResolveAccess();
  const { openSignIn } = useSignInModal();
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [local, setLocal] = useState(draft);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setLocal(draft);
  }, [draft]);

  useEffect(() => {
    registerFocus(() => inputRef.current?.focus());
  }, [registerFocus]);

  const handleSubmit = useCallback(async () => {
    const text = local.trim();
    if (!text && !fileRef.current?.files?.length) return;

    if (!ready) {
      openSignIn();
      return;
    }

    if (pathname === "/") {
      submitFromHome(text);
      return;
    }

    await submitOnStart(text);
    setLocal("");
    setDraft("");
  }, [local, ready, pathname, submitFromHome, submitOnStart, setDraft, openSignIn]);

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    if (!ready) {
      openSignIn();
      return;
    }
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const form = new FormData();
        form.append("file", file);
        if (activeTaskId) form.append("taskId", activeTaskId);
        const res = await fetch("/api/evidence/upload", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Upload failed");
        toast.success("Proof uploaded", { description: data.message });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!show) return null;

  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 w-full max-w-2xl -translate-x-1/2 px-4"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className={clsx(
          "pointer-events-auto overflow-hidden rounded-2xl border border-white/10",
          "bg-resolve-surface/90 shadow-[0_0_40px_-8px_rgba(56,189,248,0.35)] backdrop-blur-xl"
        )}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <input
            ref={inputRef}
            type="text"
            value={local}
            onChange={(e) => {
              setLocal(e.target.value);
              setDraft(e.target.value);
            }}
            onKeyDown={(e) => e.key === "Enter" && void handleSubmit()}
            placeholder="What should RESOLVE handle?"
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-resolve-muted"
          />
          <input
            ref={fileRef}
            type="file"
            multiple
            accept=".pdf,.png,.jpg,.jpeg,.webp,.mp4,.mov,.zip,.csv,.txt,.docx,.xlsx"
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 text-resolve-muted transition hover:border-sky-500/30 hover:text-white"
            aria-label="Attach proof"
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Paperclip className="h-4 w-4" />
            )}
          </button>
          <button
            type="button"
            disabled={submitLoading || uploading || !local.trim()}
            onClick={() => void handleSubmit()}
            className="flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-sky-500 px-4 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-40"
          >
            {submitLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                Send
                <Send className="h-3.5 w-3.5" />
              </>
            )}
          </button>
        </div>
        {pathname === "/" && (
          <div className="flex flex-wrap gap-1.5 border-t border-white/[0.06] px-3 py-2">
            {EXAMPLES.slice(0, 3).map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => {
                  setLocal(ex);
                  setDraft(ex);
                  focusBar();
                }}
                className="rounded-full border border-white/10 px-2.5 py-0.5 text-[10px] text-resolve-muted hover:border-sky-500/30 hover:text-white"
              >
                {ex}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
