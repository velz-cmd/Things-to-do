"use client";

import type { FormEvent, ReactNode } from "react";
import { Loader2, Send } from "lucide-react";
import clsx from "clsx";
import { DiscoverCapitalCard } from "@/components/resolve/discover/discover-capital-card";

type MissionPromptFieldProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading?: boolean;
  placeholder?: string;
  className?: string;
  footer?: ReactNode;
};

/** Discover-matched mission prompt — capital card shell + primary action button. */
export function MissionPromptField({
  value,
  onChange,
  onSubmit,
  loading,
  placeholder = "Name a community and objective — or pick an intent above",
  className,
  footer,
}: MissionPromptFieldProps) {
  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!value.trim() || loading) return;
    onSubmit();
  }

  return (
    <DiscoverCapitalCard className={clsx("discover-search-card", className)} padding={false}>
      <div className="relative p-2.5 sm:p-3">
        <form onSubmit={handleSubmit} className="relative">
          <input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={loading}
            autoFocus
            className="w-full rounded-xl border border-resolve-accent/25 bg-[#060a12]/80 py-3 pl-4 pr-14 text-sm text-white shadow-[0_0_32px_rgba(96,165,250,0.06)] placeholder:text-resolve-muted-dim focus:border-resolve-accent/50 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !value.trim()}
            className="discover-action-btn discover-action-btn--primary absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center !min-h-0 !p-0"
            aria-label="Submit"
          >
            {loading ?
              <Loader2 className="h-4 w-4 animate-spin" />
            : <Send className="h-4 w-4" />}
          </button>
        </form>
        {footer}
      </div>
    </DiscoverCapitalCard>
  );
}
