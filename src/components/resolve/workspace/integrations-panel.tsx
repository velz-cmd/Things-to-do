"use client";

import { useEffect, useState } from "react";
import { Panel } from "@/components/resolve/ui/panel";
import type { ConnectorMeta } from "@/lib/connectors/types";

export function IntegrationsPanel() {
  const [connectors, setConnectors] = useState<ConnectorMeta[]>([]);

  useEffect(() => {
    void fetch("/api/connectors/catalog")
      .then((r) => r.json())
      .then((d) => setConnectors(d.connectors ?? []));
  }, []);

  return (
    <Panel className="p-4">
      <p className="text-sm font-medium text-white">Current integrations</p>
      <p className="mt-0.5 text-xs text-resolve-muted">
        Settlement attaches beside software communities already use — not a separate destination.
      </p>
      <ul className="mt-3 space-y-2">
        {connectors.map((c) => (
          <li key={c.id} className="flex items-start justify-between gap-2 text-sm">
            <div>
              <p className="font-medium text-white">{c.label}</p>
              <p className="text-xs text-resolve-muted">{c.description}</p>
            </div>
            <StatusBadge status={c.status} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function StatusBadge({ status }: { status: ConnectorMeta["status"] }) {
  const label = status === "live" ? "Live" : status === "demo" ? "Beta" : "Upcoming";
  const cls =
    status === "live" ? "text-emerald-300 bg-emerald-500/15"
    : status === "demo" ? "text-amber-300 bg-amber-500/15"
    : "text-resolve-muted bg-white/5";
  return (
    <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-medium uppercase ${cls}`}>
      {label}
    </span>
  );
}
