"use client";

import { useState } from "react";
import clsx from "clsx";
import type { TaskEvent } from "@/lib/deputy/ui-types";
import { isTechnicalEvent } from "@/lib/tasks/timeline-humanize";

export function TechnicalAuditDrawer({
  events,
  microPayments,
}: {
  events: TaskEvent[];
  microPayments?: { purpose: string; amountUsd: number; createdAt: string }[];
}) {
  const [open, setOpen] = useState(false);
  const technical = events.filter(isTechnicalEvent);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-deputy-muted underline hover:text-white"
      >
        View technical audit
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
          <div className="flex h-full w-full max-w-md flex-col border-l border-deputy-border bg-deputy-bg shadow-xl">
            <header className="flex items-center justify-between border-b border-deputy-border p-4">
              <h2 className="font-semibold">Technical audit</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-deputy-muted hover:text-white"
              >
                Close
              </button>
            </header>
            <div className="flex-1 overflow-y-auto p-4 font-mono text-xs">
              {technical.length === 0 && (
                <p className="text-deputy-muted">No technical events yet.</p>
              )}
              {technical.map((ev) => (
                <div
                  key={ev.id}
                  className="mb-3 rounded border border-deputy-border/60 bg-deputy-panel/50 p-2"
                >
                  <p className="text-deputy-muted">
                    {ev.agent} · {ev.phase}
                  </p>
                  <p className="mt-1 text-white/90">{ev.message}</p>
                  <p className="mt-1 text-[10px] text-deputy-muted">{ev.createdAt}</p>
                </div>
              ))}
              {microPayments && microPayments.length > 0 && (
                <>
                  <p className="mb-2 mt-4 text-deputy-muted">Execution costs</p>
                  {microPayments.map((mp, i) => (
                    <div key={i} className="mb-2 text-deputy-muted">
                      {mp.purpose}: ${mp.amountUsd.toFixed(4)} · {mp.createdAt}
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
