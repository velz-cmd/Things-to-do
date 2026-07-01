"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { Bell, Loader2, Play, Zap } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/resolve/ui/button";
import {
  AUTOMATION_TRIGGERS,
  type AutomationNotifyChannel,
  type AutomationRuleRecord,
  type AutomationTrigger,
} from "@/lib/automation/types";
import { simulateAutomationRule } from "@/lib/automation/simulate";

type TriggerOption = {
  id: AutomationTrigger;
  label: string;
  defaultAuthorizeUsd: number;
};

type Props = {
  communitySlug: string;
  signedIn: boolean;
  initialTrigger?: AutomationTrigger;
  onSignIn: () => void;
  onRuleLive?: (rule: AutomationRuleRecord) => void;
};

export function DiscoverAutomationRuleBuilder({
  communitySlug,
  signedIn,
  initialTrigger = "docs_merge",
  onSignIn,
  onRuleLive,
}: Props) {
  const [triggers, setTriggers] = useState<TriggerOption[]>(
    AUTOMATION_TRIGGERS.map((t) => ({
      id: t.id,
      label: t.label,
      defaultAuthorizeUsd: t.defaultAuthorizeUsd,
    })),
  );
  const [liveRule, setLiveRule] = useState<AutomationRuleRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [trigger, setTrigger] = useState<AutomationTrigger>(initialTrigger);
  const [authorizeUsd, setAuthorizeUsd] = useState(
    AUTOMATION_TRIGGERS.find((t) => t.id === initialTrigger)?.defaultAuthorizeUsd ?? 25,
  );
  const [notifyChannel, setNotifyChannel] = useState<AutomationNotifyChannel>("email");
  const [notifyTarget, setNotifyTarget] = useState("");
  const [simulation, setSimulation] = useState<ReturnType<typeof simulateAutomationRule> | null>(null);

  const load = useCallback(async () => {
    if (!signedIn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/communities/${communitySlug}/automations`);
      const data = await res.json();
      if (data.triggers?.length) setTriggers(data.triggers);
      if (data.notifyEmail && !notifyTarget) setNotifyTarget(data.notifyEmail);
      if (data.liveRule) {
        setLiveRule(data.liveRule);
        setTrigger(data.liveRule.triggerEvent);
        setAuthorizeUsd(data.liveRule.authorizeUsd);
        setNotifyChannel(data.liveRule.notifyChannel);
        setNotifyTarget(data.liveRule.notifyTarget);
      }
    } finally {
      setLoading(false);
    }
  }, [communitySlug, signedIn, notifyTarget]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setTrigger(initialTrigger);
    const def = AUTOMATION_TRIGGERS.find((t) => t.id === initialTrigger);
    if (def) setAuthorizeUsd(def.defaultAuthorizeUsd);
  }, [initialTrigger]);

  function onTriggerChange(next: AutomationTrigger) {
    setTrigger(next);
    const def = AUTOMATION_TRIGGERS.find((t) => t.id === next);
    if (def) setAuthorizeUsd(def.defaultAuthorizeUsd);
    setSimulation(null);
  }

  async function runSimulate() {
    setSimulating(true);
    try {
      const res = await fetch(`/api/communities/${communitySlug}/automations/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggerEvent: trigger, authorizeUsd, notifyChannel, sampleEvents: 25 }),
      });
      const data = await res.json();
      if (data.simulation) setSimulation(data.simulation);
      else toast.error("Simulation failed");
    } catch {
      toast.error("Could not simulate rule");
    } finally {
      setSimulating(false);
    }
  }

  async function saveRule() {
    if (!signedIn) {
      onSignIn();
      return;
    }
    if (!notifyTarget.trim()) {
      toast.error("Enter email or webhook URL");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/communities/${communitySlug}/automations`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          triggerEvent: trigger,
          authorizeUsd,
          notifyChannel,
          notifyTarget: notifyTarget.trim(),
          enable: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not save rule");
        return;
      }
      setLiveRule(data.rule);
      onRuleLive?.(data.rule);
      toast.success("Automation rule live", {
        description: `When ${triggers.find((t) => t.id === trigger)?.label} → authorize $${authorizeUsd}`,
      });
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  }

  const triggerDef = AUTOMATION_TRIGGERS.find((t) => t.id === trigger);

  if (loading && signedIn) {
    return (
      <div className="flex items-center gap-2 text-sm text-resolve-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading automation rules…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[11px] leading-relaxed text-resolve-muted-dim">
        Sensors authorize on ingest at the amounts below; this rule notifies you and links the ledger
        receipt when a matching event lands.
      </p>
      {liveRule && (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/[0.06] px-3 py-2.5 text-xs text-emerald-100">
          <span className="font-semibold uppercase tracking-wide text-emerald-400">Live rule</span>
          <p className="mt-1">
            {liveRule.name} · last fired{" "}
            {liveRule.lastFiredAt ? new Date(liveRule.lastFiredAt).toLocaleString() : "awaiting ingest"}
          </p>
        </div>
      )}

      <div className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-accent">
          When
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {triggers.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => onTriggerChange(t.id)}
              className={clsx(
                "rounded-lg border px-3 py-1.5 text-[11px] font-medium transition",
                trigger === t.id
                  ? "border-resolve-accent/40 bg-resolve-accent/15 text-white"
                  : "border-white/10 text-resolve-muted hover:text-white",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-resolve-accent">
          Authorize
        </p>
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm text-resolve-muted">$</span>
          <input
            type="number"
            min={0.0001}
            step={trigger === "play" ? 0.0001 : 0.01}
            value={authorizeUsd}
            onChange={(e) => setAuthorizeUsd(Number(e.target.value))}
            className="w-28 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white"
          />
          <span className="text-[11px] text-resolve-muted">
            per {triggerDef?.billingUnit ?? "event"} · syncs {triggerDef?.programTemplateId}
          </span>
        </div>

        <p className="mt-4 text-[10px] font-semibold uppercase tracking-wider text-resolve-accent">
          Notify
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["email", "webhook"] as const).map((ch) => (
            <button
              key={ch}
              type="button"
              onClick={() => setNotifyChannel(ch)}
              className={clsx(
                "rounded-lg border px-3 py-1.5 text-[11px] font-medium capitalize",
                notifyChannel === ch
                  ? "border-resolve-accent/40 bg-resolve-accent/15 text-white"
                  : "border-white/10 text-resolve-muted",
              )}
            >
              {ch}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={notifyTarget}
          onChange={(e) => setNotifyTarget(e.target.value)}
          placeholder={notifyChannel === "email" ? "you@community.org" : "https://hooks.example.com/resolve"}
          className="mt-2 w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-resolve-muted-dim"
        />
      </div>

      {simulation && (
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[11px] text-resolve-muted">
          <p className="font-medium text-white">Simulation · {simulation.sampleEvents} events</p>
          <p className="mt-1">
            Projected authorize ${simulation.projectedAuthorizeUsd.toFixed(4)} via{" "}
            {simulation.connectorId}/{simulation.eventType}
          </p>
          <p className="mt-1 text-resolve-muted-dim">{simulation.note}</p>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={simulating}
          onClick={() => void runSimulate()}
        >
          {simulating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Simulate
        </Button>
        <Button size="sm" className="gap-1.5" disabled={saving} onClick={() => void saveRule()}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          {liveRule ? "Update live rule" : "Go live"}
        </Button>
      </div>

      <p className="flex items-start gap-1.5 text-[10px] text-resolve-muted-dim">
        <Bell className="mt-0.5 h-3 w-3 shrink-0" />
        Rules tie to program policies and fire on POST /api/authorization/ingest — one live rule per community.
      </p>
    </div>
  );
}
