import type { DashboardStats } from "@/lib/deputy/ui-types";

export function OutcomeSnapshot({ stats }: { stats: DashboardStats | null }) {
  const cards = [
    { label: "Money recovered", value: `+$${(stats?.moneyRecoveredUsd ?? 0).toFixed(0)}` },
    {
      label: "Monthly savings",
      value: `+$${((stats?.subscriptionsCancelled ?? 0) * 14).toFixed(0)}/mo`,
    },
    { label: "Execution cost", value: `$${(stats?.executionCostUsd ?? 0).toFixed(2)}` },
    { label: "Net gain", value: `+$${(stats?.netGainUsd ?? 0).toFixed(0)}`, accent: true },
    { label: "Tasks completed", value: String(stats?.tasksCompleted ?? 0) },
  ];

  return (
    <section>
      <h2 className="mb-3 text-xs font-medium uppercase tracking-wide text-deputy-muted">
        Outcome snapshot
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-xl border border-deputy-border bg-deputy-panel p-4"
          >
            <p className="text-xs text-deputy-muted">{c.label}</p>
            <p
              className={`mt-1 text-2xl font-semibold ${c.accent ? "text-deputy-accent" : "text-white"}`}
            >
              {c.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
