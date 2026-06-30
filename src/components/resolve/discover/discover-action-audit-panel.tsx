"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { ActionAuditEntry, ActionAuditStatus, DiscoverAction } from "@/lib/discover/types";
import {
  actionRequiresAuth,
  apiEndpointForAction,
  requiredDataForAction,
} from "@/lib/discover/action-metadata";

const IS_DEV = process.env.NODE_ENV === "development";

type DiscoverActionAuditContextValue = {
  entries: ActionAuditEntry[];
  registerVisibleAction: (surface: string, action: DiscoverAction) => void;
  reportActionStatus: (
    surface: string,
    action: DiscoverAction,
    status: ActionAuditStatus,
    blocker?: string,
  ) => void;
  clearAudit: () => void;
};

const DiscoverActionAuditContext = createContext<DiscoverActionAuditContextValue | null>(null);

function auditKey(surface: string, action: DiscoverAction) {
  return `${surface}:${action.id}:${action.kind}`;
}

export function DiscoverActionAuditProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<ActionAuditEntry[]>([]);

  const upsert = useCallback((entry: ActionAuditEntry) => {
    setEntries((prev) => {
      const idx = prev.findIndex((e) => e.id === entry.id);
      if (idx === -1) return [entry, ...prev].slice(0, 120);
      const next = [...prev];
      next[idx] = entry;
      return next;
    });
  }, []);

  const registerVisibleAction = useCallback(
    (surface: string, action: DiscoverAction) => {
      if (!IS_DEV) return;
      const id = auditKey(surface, action);
      upsert({
        id,
        surface,
        label: action.label,
        actionType: action.kind,
        requiredAuth: actionRequiresAuth(action.kind),
        requiredData: requiredDataForAction(action),
        apiEndpoint: apiEndpointForAction(action),
        currentStatus: "idle",
        timestamp: new Date().toISOString(),
      });
    },
    [upsert],
  );

  const reportActionStatus = useCallback(
    (surface: string, action: DiscoverAction, status: ActionAuditStatus, blocker?: string) => {
      if (!IS_DEV) return;
      const id = auditKey(surface, action);
      upsert({
        id,
        surface,
        label: action.label,
        actionType: action.kind,
        requiredAuth: actionRequiresAuth(action.kind),
        requiredData: requiredDataForAction(action),
        apiEndpoint: apiEndpointForAction(action),
        currentStatus: status,
        blocker,
        timestamp: new Date().toISOString(),
      });
      if (typeof console !== "undefined" && console.table) {
        console.table([
          {
            label: action.label,
            actionType: action.kind,
            requiredAuth: actionRequiresAuth(action.kind),
            apiEndpoint: apiEndpointForAction(action),
            status,
            blocker: blocker ?? "",
          },
        ]);
      }
    },
    [upsert],
  );

  const clearAudit = useCallback(() => setEntries([]), []);

  const value = useMemo(
    () => ({ entries, registerVisibleAction, reportActionStatus, clearAudit }),
    [entries, registerVisibleAction, reportActionStatus, clearAudit],
  );

  return (
    <DiscoverActionAuditContext.Provider value={value}>
      {children}
    </DiscoverActionAuditContext.Provider>
  );
}

export function useDiscoverActionAudit() {
  const ctx = useContext(DiscoverActionAuditContext);
  if (!ctx) {
    return {
      entries: [] as ActionAuditEntry[],
      registerVisibleAction: () => {},
      reportActionStatus: () => {},
      clearAudit: () => {},
      isDev: false,
    };
  }
  return { ...ctx, isDev: IS_DEV };
}

const STATUS_COLORS: Record<ActionAuditStatus, string> = {
  idle: "text-resolve-muted",
  pending: "text-amber-300",
  success: "text-emerald-300",
  blocked: "text-orange-300",
  error: "text-red-300",
};

/** Dev-only floating audit panel — lists every registered Discover action. */
export function DiscoverActionAuditPanel() {
  const { entries, clearAudit, isDev } = useDiscoverActionAudit();
  const [open, setOpen] = useState(false);

  if (!isDev) return null;

  const blocked = entries.filter((e) => e.currentStatus === "blocked" || e.currentStatus === "error");

  return (
    <div className="fixed bottom-4 right-4 z-[60] max-w-md">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full border border-violet-500/40 bg-violet-950/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-violet-200 shadow-lg backdrop-blur"
      >
        Action audit ({entries.length}
        {blocked.length ? ` · ${blocked.length} issues` : ""})
      </button>
      {open && (
        <div className="mt-2 max-h-80 overflow-auto rounded-xl border border-violet-500/30 bg-[#0a0814]/95 p-3 text-[10px] shadow-2xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="font-semibold text-violet-200">Discover action audit</p>
            <button type="button" onClick={clearAudit} className="text-resolve-muted hover:text-white">
              Clear
            </button>
          </div>
          {entries.length === 0 ? (
            <p className="text-resolve-muted">No actions registered yet — scroll Discover surfaces.</p>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="text-resolve-muted-dim">
                  <th className="pb-1 pr-2">Label</th>
                  <th className="pb-1 pr-2">Type</th>
                  <th className="pb-1 pr-2">Auth</th>
                  <th className="pb-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {entries.slice(0, 40).map((e) => (
                  <tr key={e.id} className="border-t border-white/[0.06] align-top">
                    <td className="py-1 pr-2 text-white">{e.label}</td>
                    <td className="py-1 pr-2 text-resolve-muted">{e.actionType}</td>
                    <td className="py-1 pr-2">{e.requiredAuth ? "yes" : "no"}</td>
                    <td className={`py-1 ${STATUS_COLORS[e.currentStatus]}`}>
                      {e.currentStatus}
                      {e.blocker ? ` — ${e.blocker}` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
