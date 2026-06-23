import type { TaskEvent } from "@/lib/deputy/ui-types";
import clsx from "clsx";

const PACKAGE_STEPS = [
  { key: "assigned", label: "Task assigned", hint: "Outcome registered with RESOLVE" },
  { key: "booking", label: "Booking found", hint: "Evidence pulled from email & records" },
  { key: "policy", label: "Policy verified", hint: "Eligibility checked against merchant rules" },
  { key: "support", label: "Support contacted", hint: "Claim drafted and submitted" },
  { key: "claim", label: "Claim submitted", hint: "Ticket reference captured" },
  { key: "followup", label: "Follow-up sent", hint: "Agent nudges merchant if silent" },
  { key: "escalation", label: "Escalation", hint: "Formal dispute if needed" },
  { key: "refund", label: "Refund approval", hint: "Proof verified — funds released" },
] as const;

function stepFromEvents(events: TaskEvent[], status: string) {
  const phases = new Set(events.map((e) => e.phase));
  const done = (keys: string[]) =>
    keys.some(
      (k) =>
        phases.has(k) ||
        events.some((e) => e.message.toLowerCase().includes(k))
    );

  const flags = {
    assigned: events.length > 0,
    booking:
      done(["evidence_gathering", "tool"]) &&
      events.some(
        (e) =>
          e.message.includes("booking") || e.message.includes("Gmail")
      ),
    policy: phases.has("planning"),
    support: phases.has("executing"),
    claim: events.some(
      (e) =>
        e.message.includes("submitted") ||
        e.message.includes("ticket") ||
        e.message.includes("Confirmation captured") ||
        e.phase === "browser"
    ),
    followup:
      phases.has("retrying") || phases.has("waiting_for_response"),
    escalation: phases.has("escalated") || status === "escalated",
    refund: ["verified", "settled"].includes(status),
  };

  const firstPending = PACKAGE_STEPS.findIndex(
    (s) => !flags[s.key as keyof typeof flags]
  );

  return PACKAGE_STEPS.map((step, index) => {
    const complete = flags[step.key as keyof typeof flags];
    const current = !complete && index === firstPending;
    const latest = [...events]
      .reverse()
      .find((e) => {
        const m = e.message.toLowerCase();
        return (
          (step.key === "booking" && m.includes("booking")) ||
          (step.key === "claim" &&
            (m.includes("ticket") || m.includes("confirmation"))) ||
          (step.key === "support" &&
            (e.phase === "executing" || e.phase === "browser")) ||
          (step.key === "refund" && ["verified", "settled"].includes(e.phase))
        );
      });

    return {
      ...step,
      complete,
      current,
      detail: latest?.message,
      time: latest?.createdAt,
    };
  });
}

function formatTime(iso?: string) {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

export function PackageTimeline({
  events,
  status,
}: {
  events: TaskEvent[];
  status: string;
}) {
  const steps = stepFromEvents(events, status);
  const completedCount = steps.filter((s) => s.complete).length;
  const progressPct = Math.round((completedCount / steps.length) * 100);

  return (
    <section className="overflow-hidden rounded-2xl border border-deputy-border bg-gradient-to-b from-deputy-panel to-deputy-panel/80 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between border-b border-deputy-border/80 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Mission timeline</h2>
          <p className="mt-0.5 text-xs text-deputy-muted">
            {completedCount} of {steps.length} steps complete
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-semibold text-deputy-accent">
            {progressPct}%
          </p>
          <p className="text-[10px] uppercase tracking-wide text-deputy-muted">
            progress
          </p>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-deputy-bg">
          <div
            className="h-full rounded-full bg-gradient-to-r from-deputy-accent/80 to-deputy-accent transition-all duration-500"
            style={{ width: `${Math.max(progressPct, 4)}%` }}
          />
        </div>

        <ol className="space-y-0">
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            const time = formatTime(step.time);

            return (
              <li key={step.key} className="relative flex gap-4 pb-5">
                {!isLast && (
                  <span
                    className={clsx(
                      "absolute left-[15px] top-8 w-0.5",
                      step.complete ? "bg-deputy-accent/50" : "bg-deputy-border"
                    )}
                    style={{ height: "calc(100% - 1rem)" }}
                  />
                )}

                <span
                  className={clsx(
                    "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold",
                    step.complete &&
                      "border-deputy-accent bg-deputy-accent/15 text-deputy-accent",
                    step.current &&
                      "border-deputy-warn bg-deputy-warn/15 text-deputy-warn ring-2 ring-deputy-warn/30",
                    !step.complete &&
                      !step.current &&
                      "border-deputy-border bg-deputy-bg text-deputy-muted"
                  )}
                >
                  {step.complete ? "✓" : step.current ? "●" : index + 1}
                </span>

                <div className="min-w-0 flex-1 pt-0.5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p
                      className={clsx(
                        "text-sm font-medium",
                        step.complete && "text-white",
                        step.current && "text-deputy-warn",
                        !step.complete && !step.current && "text-slate-300"
                      )}
                    >
                      {step.label}
                      {step.current && (
                        <span className="ml-2 text-xs font-normal text-deputy-warn/90">
                          In progress
                        </span>
                      )}
                    </p>
                    {time && (
                      <time className="text-[10px] text-deputy-muted">{time}</time>
                    )}
                  </div>
                  <p
                    className={clsx(
                      "mt-0.5 text-xs leading-relaxed",
                      step.detail ? "text-slate-400" : "text-deputy-muted"
                    )}
                  >
                    {step.detail ?? step.hint}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
