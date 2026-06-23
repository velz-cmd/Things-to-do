"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { Proof } from "@/lib/deputy/ui-types";

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
    <div className="mx-auto max-w-3xl space-y-6 p-4 lg:p-8">
      <header>
        <h1 className="text-2xl font-semibold">Proof</h1>
        <p className="mt-1 text-sm text-deputy-muted">Verified evidence and artifacts</p>
      </header>

      {proofs.length === 0 ? (
        <p className="text-sm text-deputy-muted">
          No proof objects yet. Complete a mission to see verified evidence here.
        </p>
      ) : (
        <ul className="space-y-3">
          {proofs.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-deputy-border bg-deputy-panel p-4"
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">{p.type.replace(/_/g, " ")}</p>
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
              <p className="mt-1 text-xs text-deputy-muted">Source: {p.source}</p>
              <p className="mt-2 font-mono text-[10px] text-deputy-muted break-all">
                {p.contentHash}
              </p>
              {p.artifactUrl && (
                <a
                  href={p.artifactUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-block text-sm text-blue-400 underline"
                >
                  Open artifact
                </a>
              )}
            </li>
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
