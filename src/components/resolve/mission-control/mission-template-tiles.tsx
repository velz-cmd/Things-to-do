"use client";

import clsx from "clsx";
import { MISSION_RFB_TEMPLATES } from "@/lib/mission/mission-templates";
import { TemplateDiagram } from "@/components/resolve/visuals/capital-compiler";

export function MissionTemplateTiles({
  onSubmit,
  className,
}: {
  onSubmit: (prompt: string) => void;
  className?: string;
}) {
  return (
    <section className={clsx("mission-templates", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p className="mission-eyebrow">One-click templates</p>
        <span className="text-[10px] text-resolve-muted-dim">Operators · settlement rails</span>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {MISSION_RFB_TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onSubmit(t.prompt)}
            className="mission-template-card"
          >
            <span className="grid grid-cols-[1fr_96px] items-center gap-3">
              <span><span className="block text-sm font-semibold text-white">{t.label}</span><span className="mt-1 block text-left text-[11px] leading-snug text-resolve-muted">{t.surfaces}</span></span>
              <TemplateDiagram id={t.id} />
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
