"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/resolve/ui/page-header";
import { GlassPanel } from "@/components/resolve/ui/glass-panel";
import { AgentCredentialPanel } from "@/components/resolve/agent-credential-panel";
import type { Proof } from "@/lib/deputy/ui-types";
import Link from "next/link";

function ProofContent() {
  const searchParams = useSearchParams();
  const taskFilter = searchParams.get("task");
  const [proofs, setProofs] = useState<Proof[]>([]);
  const [tasks, setTasks] = useState<{ id: string; title: string }[]>([]);

  useEffect(() => {
    void (async () => {
      const t = await fetch("/api/tasks").then((r) => r.json());
      const allTasks = t.tasks ?? [];
      setTasks(allTasks.map((x: { id: string; title: string }) => ({ id: x.id, title: x.title })));

      const collected: Proof[] = [];
      for (const task of allTasks) {
        if (taskFilter && task.id !== taskFilter) continue;
        const res = await fetch(`/api/proofs/${task.id}`);
        if (!res.ok) continue;
        const data = await res.json();
        for (const p of data.proofs ?? []) {
          collected.push({ ...p, taskId: task.id } as Proof & { taskId: string });
        }
      }
      setProofs(collected);
    })();
  }, [taskFilter]);

  return (
    <div className="resolve-grid-bg mx-auto max-w-3xl space-y-6 px-4 py-8 lg:px-8">
      <PageHeader title="Proof" subtitle="Receipts, screenshots, confirmations." />

      <AgentCredentialPanel compact />

      {proofs.length === 0 ? (
        <GlassPanel className="p-8 text-center">
          <p className="text-resolve-muted">No proof yet.</p>
          <p className="mt-2 text-sm text-resolve-muted">
            Start a mission or upload a receipt to create proof.
          </p>
          <Link href="/start" className="mt-4 inline-block text-sm font-medium text-sky-400 hover:underline">
            Start a task →
          </Link>
        </GlassPanel>
      ) : (
        <ul className="space-y-3">
          {proofs.map((p) => (
            <GlassPanel key={p.id} className="p-4">
              <div className="flex items-center justify-between">
                <p className="font-medium text-white">{p.type.replace(/_/g, " ")}</p>
                <span
                  className={
                    p.verified
                      ? "text-xs text-emerald-400"
                      : "text-xs text-amber-400"
                  }
                >
                  {p.verified ? "Verified" : "Pending"}
                </span>
              </div>
              <p className="mt-1 text-xs text-resolve-muted">Source: {p.source}</p>
              <p className="mt-2 font-mono text-[10px] text-resolve-muted break-all">
                {p.contentHash}
              </p>
              {p.artifactUrl && (
                <a
                  href={p.artifactUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm text-sky-400 underline"
                >
                  Open proof
                </a>
              )}
            </GlassPanel>
          ))}
        </ul>
      )}

      {tasks.length > 0 && !taskFilter && (
        <p className="text-xs text-deputy-muted">
          Showing proofs from {tasks.length} mission(s)
        </p>
      )}
    </div>
  );
}

export default function ProofPage() {
  return (
    <Suspense fallback={<div className="p-8 text-deputy-muted">Loading proof…</div>}>
      <ProofContent />
    </Suspense>
  );
}
