"use client";

import clsx from "clsx";
import { MISSION_RFB_TEMPLATES } from "@/lib/mission/mission-templates";

export function MissionTemplateTiles({
  onSubmit,
  className,
}: {
  onSubmit: (prompt: string) => void;
  className?: string;
}) {
  return (
    <div className={clsx("mt-4", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
        RFB templates · one-click missions
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {MISSION_RFB_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSubmit(t.prompt)}
            className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2.5 text-left transition hover:border-sky-500/30 hover:bg-sky-500/[0.04]"
          >
            <span className="block text-sm font-medium text-white/90">{t.label}</span>
            <span className="mt-0.5 block text-[10px] text-resolve-muted-dim">{t.surfaces}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
