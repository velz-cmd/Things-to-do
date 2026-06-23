"use client";

import { useState } from "react";
import { OUTCOME_EXAMPLES } from "@/lib/resolve/progress";
import clsx from "clsx";
import type { TaskClassification } from "@/lib/tasks/classifier";

export function CommandInput({
  loading,
  signedIn,
  onSignInRequired,
  onSubmit,
  classification,
}: {
  loading: boolean;
  signedIn: boolean;
  onSignInRequired?: () => void;
  onSubmit: (input: string) => void;
  classification?: TaskClassification | null;
}) {
  const [draft, setDraft] = useState("");

  function handleSubmit() {
    if (!draft.trim()) return;
    if (!signedIn) {
      onSignInRequired?.();
      return;
    }
    onSubmit(draft.trim());
  }

  return (
    <section className="rounded-2xl border border-deputy-border bg-deputy-panel p-6">
      <label htmlFor="command-input" className="text-sm font-medium">
        What do you want RESOLVE to handle?
      </label>
      <div className="mt-3 flex gap-2">
        <input
          id="command-input"
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Cancel StreamDemo Plus and prove billing stopped"
          className="flex-1 rounded-xl border border-deputy-border bg-deputy-bg px-4 py-3 text-sm outline-none focus:border-blue-500/50"
        />
        <button
          type="button"
          disabled={loading || !draft.trim()}
          onClick={handleSubmit}
          className="shrink-0 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {loading ? "…" : "Assign"}
        </button>
      </div>

      {classification?.question && (
        <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
          {classification.question}
        </p>
      )}

      {classification && !classification.question && (
        <p className="mt-3 text-sm text-deputy-muted">
          Detected: {classification.category.replace(/_/g, " ")}
          {classification.company ? ` · ${classification.company}` : ""}
          {classification.isDemo ? " · Demo data" : ""}
        </p>
      )}

      <p className="mt-4 text-xs uppercase tracking-wide text-deputy-muted">Examples</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {OUTCOME_EXAMPLES.map((ex) => (
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
              "rounded-full border px-3 py-1.5 text-sm transition",
              "border-deputy-border text-deputy-muted hover:border-blue-500/40 hover:text-white disabled:opacity-50"
            )}
          >
            {ex.label}
          </button>
        ))}
      </div>
    </section>
  );
}
