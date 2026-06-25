"use client";

import {
  FOUNDER_PRESETS,
  type FounderPresetId,
} from "@/lib/workspace/founder-presets";
import clsx from "clsx";
import { Panel } from "@/components/resolve/ui/panel";

export function FounderPriorities({
  value,
  onChange,
}: {
  value: FounderPresetId;
  onChange: (id: FounderPresetId) => void;
}) {
  return (
    <Panel className="p-4">
      <p className="text-sm font-medium text-white">What matters most?</p>
      <p className="mt-0.5 text-xs text-resolve-muted">
        RESOLVE scores contributors within your priorities — no percentages required.
      </p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {FOUNDER_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            onClick={() => onChange(preset.id)}
            className={clsx(
              "rounded-lg border px-3 py-2.5 text-left transition",
              value === preset.id ?
                "border-resolve-accent bg-resolve-accent/10"
              : "border-resolve-border hover:border-resolve-border-strong hover:bg-white/[0.02]",
            )}
          >
            <p className="text-sm font-medium text-white">{preset.label}</p>
            <p className="mt-0.5 text-[11px] text-resolve-muted">{preset.description}</p>
          </button>
        ))}
      </div>
    </Panel>
  );
}
