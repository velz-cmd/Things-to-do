import Link from "next/link";
import type { Task } from "@/lib/deputy/ui-types";
import { taskEmoji, taskProgress, taskStatusLabel } from "@/lib/resolve/progress";
import { GlassPanel } from "@/components/resolve/ui/glass-panel";

export function ActiveMissions({
  tasks,
  basePath = "/missions",
}: {
  tasks: Task[];
  basePath?: string;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-resolve-muted">
        Active missions
      </h2>
      <div className="space-y-2">
        {tasks.map((t) => {
          const pct = taskProgress(t.status);
          return (
            <Link key={t.id} href={`${basePath}/${t.id}`} className="block">
              <GlassPanel className="flex items-center gap-4 p-4 transition hover:border-sky-500/30">
                <span className="text-2xl">{taskEmoji(t.title, t.merchantId)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{t.title}</p>
                  <p className="text-sm text-resolve-muted">{taskStatusLabel(t.status)}</p>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/40">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-sky-500 to-cyan-400 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <span className="font-mono text-sm text-sky-400">{pct}%</span>
              </GlassPanel>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
