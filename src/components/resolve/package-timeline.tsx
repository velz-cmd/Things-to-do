import type { TaskEvent } from "@/lib/deputy/ui-types";

const PACKAGE_STEPS = [
  "Task assigned",
  "Booking found",
  "Policy verified",
  "Support contacted",
  "Claim submitted",
  "Follow-up sent",
  "Escalation",
  "Refund approval",
];

function stepFromEvents(events: TaskEvent[], status: string) {
  const phases = new Set(events.map((e) => e.phase));
  const done = (keys: string[]) => keys.some((k) => phases.has(k) || events.some((e) => e.message.toLowerCase().includes(k)));

  return [
    { label: "Task assigned", complete: events.length > 0 },
    { label: "Booking found", complete: done(["evidence_gathering", "tool"]) && events.some((e) => e.message.includes("booking") || e.message.includes("Gmail")) },
    { label: "Policy verified", complete: phases.has("planning") },
    { label: "Support contacted", complete: phases.has("executing") },
    { label: "Claim submitted", complete: events.some((e) => e.message.includes("submitted") || e.message.includes("ticket")) },
    { label: "Follow-up sent", complete: phases.has("retrying") || phases.has("waiting_for_response") },
    { label: "Escalation", complete: phases.has("escalated") || status === "escalated" },
    {
      label: "Refund approval",
      complete: ["verified", "settled"].includes(status),
      current: phases.has("proof_pending") && !["verified", "settled"].includes(status),
    },
  ];
}

export function PackageTimeline({
  events,
  status,
}: {
  events: TaskEvent[];
  status: string;
}) {
  const steps = stepFromEvents(events, status);

  return (
    <section className="rounded-xl border border-deputy-border bg-deputy-panel p-5">
      <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-deputy-muted">
        Timeline
      </h2>
      <ul className="space-y-3">
        {steps.map((step) => (
          <li key={step.label} className="flex items-center gap-3 text-sm">
            <span
              className={
                step.complete
                  ? "text-deputy-accent"
                  : step.current
                    ? "text-deputy-warn"
                    : "text-deputy-muted/50"
              }
            >
              {step.complete ? "✓" : step.current ? "●" : "○"}
            </span>
            <span
              className={
                step.complete
                  ? "text-deputy-muted"
                  : step.current
                    ? "font-medium text-deputy-warn"
                    : "text-deputy-muted/60"
              }
            >
              {step.label}
              {step.current && " — in progress"}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
