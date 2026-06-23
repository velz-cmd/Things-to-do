import type { DashboardStats, Task } from "@/lib/deputy/ui-types";

export function SuccessFeed({
  tasks,
  stats,
}: {
  tasks: Task[];
  stats: DashboardStats | null;
}) {
  const items: { text: string; sub: string }[] = [];

  for (const t of tasks.slice(0, 5)) {
    items.push({
      text: `+$${t.recoveredUsd.toFixed(0)} recovered`,
      sub: t.title.slice(0, 40),
    });
  }

  if ((stats?.subscriptionsCancelled ?? 0) > 0) {
    items.push({
      text: "+$14/month saved",
      sub: "Unused subscription cancelled",
    });
  }

  if (items.length === 0) {
    items.push(
      { text: "+$87 recovered", sub: "Example: refund approved" },
      { text: "+$14/month saved", sub: "Example: subscription cancelled" },
      { text: "+$128 found", sub: "Example: forgotten airdrop (Vault)" }
    );
  }

  return (
    <section>
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-deputy-muted">
        Success feed
      </h2>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={i}
            className="flex items-center justify-between rounded-lg border border-deputy-border bg-deputy-panel px-4 py-3"
          >
            <span className="font-medium text-deputy-accent">{item.text}</span>
            <span className="text-sm text-deputy-muted">{item.sub}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
