import { Card, Metric } from "@/components/ui";
import type { DashboardStats } from "@/lib/deputy/ui-types";

export function OutcomeDashboard({ stats }: { stats: DashboardStats | null }) {
  const cards = [
    {
      label: "Money recovered",
      value: `$${(stats?.moneyRecoveredUsd ?? 0).toFixed(2)}`,
      accent: "text-deputy-accent",
    },
    {
      label: "Subscriptions cancelled",
      value: String(stats?.subscriptionsCancelled ?? 0),
      accent: "text-white",
    },
    {
      label: "Execution cost",
      value: `$${(stats?.executionCostUsd ?? 0).toFixed(2)}`,
      accent: "text-deputy-warn",
    },
    {
      label: "Net gain",
      value: `$${(stats?.netGainUsd ?? 0).toFixed(2)}`,
      accent: "text-deputy-accent",
    },
    {
      label: "Tasks completed",
      value: String(stats?.tasksCompleted ?? 0),
      accent: "text-white",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {cards.map((c) => (
        <Card key={c.label} className="p-3">
          <Metric label={c.label} value={c.value} accent={c.accent} />
        </Card>
      ))}
    </div>
  );
}
