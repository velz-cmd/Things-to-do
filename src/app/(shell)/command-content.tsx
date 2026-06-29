"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CommandInput } from "@/components/resolve/command-input";
import { ConnectorReadinessPanel } from "@/components/resolve/connector-readiness-panel";
import { ChatAssistant } from "@/components/resolve/chat-assistant";
import { ActiveMissions } from "@/components/resolve/active-missions";
import { PageHeader } from "@/components/resolve/ui/page-header";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import { useSignInModal } from "@/components/auth/sign-in-context";
import type { Task } from "@/lib/deputy/ui-types";
import type { ConnectorStatus } from "@/lib/connectors/connector-types";
import type { TaskClassification } from "@/lib/tasks/classifier";

export default function CommandContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { ready } = useResolveAccess();
  const { openSignIn } = useSignInModal();
  const [loading, setLoading] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [classification, setClassification] = useState<TaskClassification | null>(null);
  const prefilledTask = searchParams.get("task") ?? "";

  const refresh = useCallback(async () => {
    const [t, c] = await Promise.all([
      fetch("/api/tasks").then((r) => r.json()),
      fetch("/api/connectors/status").then((r) => r.json()),
    ]);
    setTasks(t.tasks ?? []);
    setConnectors(c.connectors ?? []);
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 8000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function handleAssign(input: string) {
    if (!ready) {
      openSignIn();
      return;
    }
    setLoading(true);
    try {
      const classifyRes = await fetch("/api/tasks/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input }),
      });
      const { classification: cls } = await classifyRes.json();
      setClassification(cls);

      if (cls.question && cls.missingInputs?.length > 0) {
        toast.message("Need more info", { description: cls.question });
        return;
      }

      const createRes = await fetch("/api/tasks/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, classification: cls }),
      });
      const data = await createRes.json();
      if (!createRes.ok) throw new Error(data.error ?? "Could not create task");

      toast.success("Mission created", {
        description: "Lock task budget to continue",
      });
      router.push(`/missions/${data.task.id}`);
    } catch (e) {
      toast.error("Could not start", {
        description: e instanceof Error ? e.message : "Try again",
      });
    } finally {
      setLoading(false);
    }
  }

  const active = tasks.filter(
    (t) => !["settled", "failed", "refunded", "cancelled"].includes(t.status)
  );

  return (
    <div className="resolve-grid-bg mx-auto max-w-3xl space-y-6 px-4 py-8 lg:px-8">
      <PageHeader
        title="Start"
        subtitle="Tell RESOLVE what to handle."
      />

      <CommandInput
        loading={loading}
        signedIn={ready}
        onSignInRequired={openSignIn}
        onSubmit={handleAssign}
        classification={classification}
        initialValue={prefilledTask}
      />

      <ConnectorReadinessPanel connectors={connectors} compact />

      {active.length > 0 && <ActiveMissions tasks={active} basePath="/missions" />}

      <ChatAssistant onClassify={handleAssign} />
    </div>
  );
}
