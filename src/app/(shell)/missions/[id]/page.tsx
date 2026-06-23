"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { MissionLiveScreen } from "@/components/resolve/mission-live-screen";
import { ChatAssistant } from "@/components/resolve/chat-assistant";
import type { Task } from "@/lib/deputy/ui-types";
import type { ConnectorStatus } from "@/lib/connectors/connector-types";
import {
  getMissingRequiredConnectors,
  nextActionLabel,
} from "@/lib/connectors/connector-service";
import { useResolveAccess } from "@/hooks/use-resolve-access";

export default function MissionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [task, setTask] = useState<Task | null>(null);
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const { ready } = useResolveAccess();

  const load = useCallback(async () => {
    const [t, c] = await Promise.all([
      fetch(`/api/tasks/${id}`).then((r) => r.json()),
      fetch(`/api/connectors/status?category=${encodeURIComponent("subscription_cancellation")}`).then(
        (r) => r.json()
      ),
    ]);
    setTask(t.task ?? null);
    setConnectors(c.connectors ?? []);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!task || ["settled", "failed", "refunded", "cancelled"].includes(task.status)) {
      return;
    }
    const interval = setInterval(load, 2500);
    return () => clearInterval(interval);
  }, [task, load]);

  async function handlePrimaryAction() {
    if (!task || !ready) return;
    setLoading(true);

    const missing = getMissingRequiredConnectors(connectors, task.category ?? "manual");

    try {
      if (missing.some((m) => m.id === "gmail")) {
        const res = await fetch("/api/connectors/gmail/connect", { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message ?? data.error);
        toast.success("Gmail connected");
        await load();
        return;
      }

      if (!task.escrowLocked) {
        toast.message("Lock Arc escrow", {
          description: "Use the settlement panel below to lock task budget",
        });
        return;
      }

      if (task.status === "needs_attention" || task.status === "escalated") {
        const res = await fetch(`/api/tasks/${id}/approve`, { method: "POST", body: "{}" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast.success("Approved");
      } else if (["waiting_for_response", "retrying"].includes(task.status)) {
        const res = await fetch(`/api/tasks/${id}/retry`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast.success("Retry started");
      } else {
        const res = await fetch(`/api/tasks/${id}/start`, { method: "POST" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        toast.success("Mission started");
      }
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed");
    } finally {
      setLoading(false);
    }
  }

  if (!task) {
    return (
      <div className="p-8 text-deputy-muted">Loading mission…</div>
    );
  }

  const missing = getMissingRequiredConnectors(connectors, task.category ?? "manual");
  const nextAction = nextActionLabel(missing, task);

  return (
    <>
      <MissionLiveScreen
        task={task}
        connectors={connectors}
        nextAction={nextAction}
        onAction={handlePrimaryAction}
        onUpdated={load}
        actionLoading={loading}
      />
      <ChatAssistant taskId={task.id} />
    </>
  );
}
