"use client";

import type { FormEvent, ReactNode } from "react";
import { Loader2, Send } from "lucide-react";
import clsx from "clsx";

type MissionPromptFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  placeholder?: string;
  className?: string;
  footer?: ReactNode;
};

/** Mission prompt — centered command bar, distinct from Discover search. */
export function MissionPromptField({
  value,
  onChange,
  onSubmit,
  loading,
  placeholder = "Ask what's owed, link your work, or describe a payout — free paths need no pool…",
  className,
  footer,
}: MissionPromptFieldProps) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim() || loading) return;
    onSubmit();
  }

  return (
    <div className={clsx("mission-prompt-shell", className)}>
      <form onSubmit={handleSubmit} className="relative">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={loading}
          autoFocus
          className="mission-prompt-input"
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className="mission-prompt-submit"
          aria-label="Run mission"
        >
          {loading ?
            <Loader2 className="h-4 w-4 animate-spin" />
          : <Send className="h-4 w-4" />}
        </button>
      </form>
      {footer}
    </div>
  );
}
