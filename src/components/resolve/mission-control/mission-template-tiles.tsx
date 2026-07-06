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
    <div className={clsx("discover-section-stack", className)}>
      <p className="discover-eyebrow text-[10px] font-semibold uppercase tracking-[0.2em]">
        RFB templates · one-click missions
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {MISSION_RFB_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSubmit(t.prompt)}
            className="discover-job-tile group !min-h-0"
          >
            <span className="min-w-0 flex-1 text-left">
              <span className="block text-sm font-semibold text-white">{t.label}</span>
              <span className="mt-0.5 block text-[10px] text-resolve-muted-dim">{t.surfaces}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
