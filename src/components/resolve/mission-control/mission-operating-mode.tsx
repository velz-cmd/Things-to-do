"use client";

import clsx from "clsx";
import type { OperatingMode } from "@/lib/mission/capital-os";
import { OPERATING_MODES } from "@/lib/mission/capital-os";

export function MissionOperatingMode({
  active,
  onChange,
  disabled,
}: {
  active: OperatingMode;
  onChange: (mode: OperatingMode) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[10px] uppercase tracking-wide text-resolve-muted-dim">Mode</span>
      {OPERATING_MODES.map((m) => (
        <button
          key={m.id}
          type="button"
          disabled={disabled}
          title={m.description}
          onClick={() => onChange(m.id)}
          className={clsx(
            "rounded-full border px-2.5 py-0.5 text-[10px] font-medium transition disabled:opacity-40",
            active === m.id ?
              "border-violet-500/40 bg-violet-500/15 text-violet-200"
            : "border-white/[0.08] text-resolve-muted hover:border-white/20 hover:text-white",
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
