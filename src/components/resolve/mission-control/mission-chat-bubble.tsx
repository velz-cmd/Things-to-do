"use client";

import clsx from "clsx";
import type { ReactNode } from "react";

export function MissionUserBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-2xl rounded-br-md bg-resolve-accent/20 px-4 py-2.5 ring-1 ring-resolve-accent/25">
        <p className="text-sm leading-relaxed text-white">{children}</p>
      </div>
    </div>
  );
}

export function MissionResolveBubble({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-500 to-violet-600 text-[11px] font-bold text-white"
        aria-hidden
      >
        R
      </div>
      <div className="min-w-0 max-w-[92%] flex-1">{children}</div>
    </div>
  );
}

export function MissionThinkingBubble({ children }: { children: ReactNode }) {
  return (
    <MissionResolveBubble>
      <div className="rounded-2xl rounded-tl-md border border-white/[0.08] bg-white/[0.03] px-4 py-3">
        {children}
      </div>
    </MissionResolveBubble>
  );
}

export function MissionResponseShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "rounded-2xl rounded-tl-md border border-white/[0.08] bg-[#111827]/80 px-4 py-4 shadow-sm backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
