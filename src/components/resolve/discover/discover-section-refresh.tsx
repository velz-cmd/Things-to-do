"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Loader2, RefreshCw } from "lucide-react";
import { SECTION_REFRESH_COOLDOWN_MS } from "@/lib/discover/role-filters";

type DiscoverSectionRefreshProps = {
  sectionId: string;
  onRefresh: () => void | Promise<void>;
  /** Override default cooldown from SECTION_REFRESH_COOLDOWN_MS */
  cooldownMs?: number;
  className?: string;
  label?: string;
  lastUpdated?: string | null;
};

function formatCooldown(ms: number): string {
  const sec = Math.ceil(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.ceil(sec / 60)}m`;
}

/** Small manual refresh control — replaces aggressive auto-polling on Discover cards. */
export function DiscoverSectionRefresh({
  sectionId,
  onRefresh,
  cooldownMs,
  className,
  label = "Refresh",
  lastUpdated,
}: DiscoverSectionRefreshProps) {
  const cooldown = cooldownMs ?? SECTION_REFRESH_COOLDOWN_MS[sectionId] ?? 60_000;
  const [busy, setBusy] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCooldown = useCallback(() => {
    setCooldownLeft(cooldown);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCooldownLeft((prev) => {
        if (prev <= 1000) {
          if (timerRef.current) clearInterval(timerRef.current);
          return 0;
        }
        return prev - 1000;
      });
    }, 1000);
  }, [cooldown]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  async function handleRefresh() {
    if (busy || cooldownLeft > 0) return;
    setBusy(true);
    try {
      await onRefresh();
      startCooldown();
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || cooldownLeft > 0;

  return (
    <div className={clsx("flex items-center gap-2", className)}>
      {lastUpdated && (
        <span className="hidden text-[9px] text-resolve-muted-dim sm:inline">
          Updated {new Date(lastUpdated).toLocaleTimeString()}
        </span>
      )}
      <button
        type="button"
        onClick={() => void handleRefresh()}
        disabled={disabled}
        title={
          cooldownLeft > 0
            ? `Available in ${formatCooldown(cooldownLeft)}`
            : `${label} (${formatCooldown(cooldown)} cooldown)`
        }
        className={clsx(
          "inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium transition",
          disabled
            ? "cursor-not-allowed border-white/5 text-resolve-muted-dim"
            : "border-white/10 text-resolve-muted hover:border-resolve-accent/30 hover:text-resolve-accent",
        )}
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCw className={clsx("h-3 w-3", cooldownLeft > 0 && "opacity-40")} />
        )}
        {cooldownLeft > 0 ? formatCooldown(cooldownLeft) : label}
      </button>
    </div>
  );
}
