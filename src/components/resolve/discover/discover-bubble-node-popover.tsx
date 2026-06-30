"use client";

import { useEffect, useRef } from "react";
import clsx from "clsx";
import type { DiscoverGraphNode } from "@/lib/discover/radar";
import type { DiscoverAction } from "@/lib/discover/types";
import { useDiscoverActions } from "@/components/resolve/discover/discover-actions-provider";

export type BubblePopoverAnchor = {
  node: DiscoverGraphNode;
  x: number;
  y: number;
};

type DiscoverBubbleNodePopoverProps = {
  anchor: BubblePopoverAnchor | null;
  actions: DiscoverAction[];
  onClose: () => void;
  mobileSheet?: boolean;
};

export function DiscoverBubbleNodePopover({
  anchor,
  actions,
  onClose,
  mobileSheet = false,
}: DiscoverBubbleNodePopoverProps) {
  const { runAction } = useDiscoverActions();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anchor) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onPointer);
    };
  }, [anchor, onClose]);

  if (!anchor) return null;

  const content = (
    <div ref={ref} className="space-y-2">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
          Node actions
        </p>
        <p className="mt-0.5 text-sm font-medium text-white">{anchor.node.label}</p>
        <p className="text-[10px] capitalize text-resolve-muted">{anchor.node.type}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        {actions.length ? (
          actions.map((action) => (
            <button
              key={action.id}
              type="button"
              onClick={() => {
                void runAction(action, "bubblemap-popover");
                onClose();
              }}
              className={clsx(
                "rounded-lg border px-3 py-2 text-left text-[12px] font-medium transition",
                action.kind === "fund"
                  ? "border-amber-500/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15"
                  : action.kind === "install"
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15"
                    : "border-white/10 bg-white/[0.04] text-resolve-muted hover:text-white",
              )}
            >
              {action.label}
            </button>
          ))
        ) : (
          <p className="text-xs text-resolve-muted">No actions for this node.</p>
        )}
      </div>
    </div>
  );

  if (mobileSheet) {
    return (
      <>
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <div
          className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border border-white/10 bg-[#060a12] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl"
          role="dialog"
          aria-label={`Actions for ${anchor.node.label}`}
        >
          {content}
        </div>
      </>
    );
  }

  const left = Math.min(Math.max(anchor.x, 120), typeof window !== "undefined" ? window.innerWidth - 120 : anchor.x);
  const top = Math.min(Math.max(anchor.y, 80), typeof window !== "undefined" ? window.innerHeight - 160 : anchor.y);

  return (
    <div
      className="fixed z-50 w-52 rounded-xl border border-white/10 bg-[#060a12]/95 p-3 shadow-2xl backdrop-blur-md"
      style={{ left, top, transform: "translate(-50%, -100%) translateY(-12px)" }}
      role="dialog"
      aria-label={`Actions for ${anchor.node.label}`}
    >
      {content}
    </div>
  );
}
