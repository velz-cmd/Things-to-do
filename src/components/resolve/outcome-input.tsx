"use client";

import { useState } from "react";
import { OUTCOME_EXAMPLES } from "@/lib/resolve/progress";
import clsx from "clsx";

export function OutcomeInput({
  loading,
  onAssign,
  onSignInRequired,
  signedIn,
}: {
  loading: boolean;
  onAssign: (text: string) => void;
  onSignInRequired?: () => void;
  signedIn?: boolean;
}) {
  const [draft, setDraft] = useState("");

  function handleExample(text: string) {
    if (!signedIn) {
      onSignInRequired?.();
      return;
    }
    onAssign(text);
  }

  return (
    <section className="rounded-2xl border border-deputy-border bg-deputy-panel p-6">
      <label htmlFor="outcome-draft" className="text-sm font-medium text-deputy-muted">
        What outcome do you want?
      </label>
      <input
        id="outcome-draft"
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Recover my delayed parcel compensation…"
        className="mt-3 w-full rounded-xl border border-deputy-border bg-deputy-bg px-4 py-3 text-sm outline-none focus:border-deputy-accent/50"
      />
      <p className="mt-4 text-xs uppercase tracking-wide text-deputy-muted">
        Examples — tap to assign
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {OUTCOME_EXAMPLES.map((ex) => (
          <button
            key={ex.label}
            type="button"
            disabled={loading}
            onClick={() => handleExample(ex.text)}
            className={clsx(
              "rounded-full border px-3 py-1.5 text-sm transition",
              "border-deputy-accent/40 text-deputy-accent hover:bg-deputy-accent/10 disabled:opacity-50"
            )}
          >
            {ex.label}
          </button>
        ))}
      </div>
    </section>
  );
}
