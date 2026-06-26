"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/resolve/ui/panel";

type LogEntry = { ts: string; level: string; domain: string; message: string };

const LEVEL_COLOR: Record<string, string> = {
  SCAN: "text-cyan-400",
  FLAG: "text-amber-300",
  OK: "text-emerald-400",
  ERR: "text-red-400",
};

/** Live intelligence feed — replaces the old Discover terminal panel. */
export function AnalysisActivityFeed({ active }: { active: boolean }) {
  const [log, setLog] = useState<LogEntry[]>([]);

  useEffect(() => {
    if (!active) {
      setLog([]);
      return;
    }

    const poll = () => {
      void fetch("/api/discover/agent-log?limit=16")
        .then((r) => r.json())
        .then((d) => setLog(d.events ?? []));
    };
    poll();
    const id = setInterval(poll, 4000);
    return () => clearInterval(id);
  }, [active]);

  if (!active || log.length === 0) return null;

  return (
    <Panel className="overflow-hidden p-0 font-mono text-[11px]">
      <div className="border-b border-resolve-border px-3 py-2">
        <p className="text-resolve-muted">Live intelligence</p>
      </div>
      <ul className="max-h-36 overflow-y-auto px-3 py-2">
        {log.map((e, i) => (
          <li key={`${e.ts}-${i}`} className="flex gap-2 py-0.5 text-resolve-muted">
            <span className={`shrink-0 font-semibold ${LEVEL_COLOR[e.level] ?? ""}`}>{e.level}</span>
            <span className="text-white/90">{e.message}</span>
          </li>
        ))}
      </ul>
    </Panel>
  );
}
