"use client";

import { useState, useEffect } from "react";
import { START_EXAMPLES } from "@/lib/resolve/progress";
import clsx from "clsx";
import { Send } from "lucide-react";
import type { TaskClassification } from "@/lib/tasks/classifier";
import { GlassPanel } from "@/components/resolve/ui/glass-panel";

export function CommandInput({
  loading,
  signedIn,
  onSignInRequired,
  onSubmit,
  classification,
  initialValue = "",
}: {
  loading: boolean;
  signedIn: boolean;
  onSignInRequired?: () => void;
  onSubmit: (input: string) => void;
  classification?: TaskClassification | null;
  initialValue?: string;
}) {
  const [draft, setDraft] = useState(initialValue);

  useEffect(() => {
    if (initialValue) setDraft(initialValue);
  }, [initialValue]);

  function handleSubmit() {
    if (!draft.trim()) return;
    if (!signedIn) {
      onSignInRequired?.();
      return;
    }
    onSubmit(draft.trim());
  }

  return (
    <GlassPanel className="p-6" glow>
      <label htmlFor="command-input" className="text-sm font-medium text-white">
        What should RESOLVE handle?
      </label>
      <div className="mt-4 flex gap-2">
        <input
          id="command-input"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Tell RESOLVE what to handle…"
          className="flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3.5 text-sm text-white outline-none placeholder:text-resolve-muted focus:border-sky-500/40"
        />
        <button
          type="button"
          disabled={loading || !draft.trim()}
          onClick={handleSubmit}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-sky-500 px-5 py-3.5 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
        >
          {loading ? "…" : (
            <>
              <Send className="h-4 w-4" />
              Assign
            </>
          )}
        </button>
      </div>

      {classification?.question && (
        <p className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-sm text-amber-100">
          {classification.question}
        </p>
      )}

      {classification && !classification.question && (
        <p className="mt-3 text-sm text-resolve-muted">
          Detected: {classification.category.replace(/_/g, " ")}
          {classification.company ? ` · ${classification.company}` : ""}
          {classification.isDemo ? " · Demo data" : ""}
        </p>
      )}

      <p className="mt-5 text-xs uppercase tracking-wide text-resolve-muted">Examples</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {START_EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            disabled={loading}
            onClick={() => {
              setDraft(ex.text);
              if (signedIn) onSubmit(ex.text);
              else onSignInRequired?.();
            }}
            className={clsx(
              "rounded-full border border-white/10 px-3 py-1.5 text-sm text-resolve-muted transition",
              "hover:border-sky-500/30 hover:text-white disabled:opacity-50"
            )}
          >
            {ex.label}
          </button>
        ))}
      </div>
    </GlassPanel>
  );
}
