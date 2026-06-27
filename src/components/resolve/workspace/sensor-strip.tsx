"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";

type Sensor = {
  id: string;
  label: string;
  status: "live" | "waiting" | "soon";
  eventsToday: number;
};

/** Sensors — infrastructure, not products. Minimal strip at OS footer. */
export function SensorStrip() {
  const [sensors, setSensors] = useState<Sensor[]>([]);

  useEffect(() => {
    void fetch("/api/workspace/overview")
      .then((r) => r.json())
      .then((d) => {
        setSensors(
          (d.sources ?? []).map((s: { id: string; label: string; status: string; eventsToday?: number }) => ({
            id: s.id,
            label: s.label,
            status:
              s.status === "connected" || s.status === "syncing" ? "live"
              : s.status === "soon" ? "soon"
              : "waiting",
            eventsToday: s.eventsToday ?? 0,
          })),
        );
      });
  }, []);

  if (!sensors.length) return null;

  return (
    <BlueGlowCard className="p-4" grid={false}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-resolve-muted-dim">
        Sensors · attach, don&apos;t replace
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {sensors.map((s) => (
          <span
            key={s.id}
            className={clsx(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-medium",
              s.status === "live" && "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
              s.status === "waiting" && "border-resolve-border text-resolve-muted",
              s.status === "soon" && "border-resolve-border/50 text-resolve-muted-dim",
            )}
          >
            <span
              className={clsx(
                "h-1.5 w-1.5 rounded-full",
                s.status === "live" && "bg-emerald-400",
                s.status === "waiting" && "bg-amber-400/80",
                s.status === "soon" && "bg-resolve-muted-dim",
              )}
            />
            {s.label}
            {s.eventsToday > 0 && (
              <span className="text-resolve-muted-dim">· {s.eventsToday} today</span>
            )}
          </span>
        ))}
      </div>
    </BlueGlowCard>
  );
}
