const AGENTS = [
  { key: "Planner", match: ["Planner", "planning", "created", "authorized"] },
  { key: "Research", match: ["Evidence", "evidence_gathering"] },
  { key: "Negotiator", match: ["Executor", "executing"] },
  { key: "Verifier", match: ["Verification", "proof_pending", "verified", "settled"] },
  { key: "Escalation", match: ["Escalation", "escalated", "Retry", "retrying", "waiting_for_response"] },
];

function agentState(
  agentKey: string,
  match: string[],
  current: string | null,
  status: string
): "complete" | "running" | "waiting" | "idle" {
  if (current && match.includes(current)) return "running";
  if (agentKey === "Verifier" && ["verified", "settled"].includes(status)) return "complete";
  if (agentKey === "Escalation" && status === "escalated") return "running";
  if (agentKey === "Planner" && !["created"].includes(status)) return "complete";
  if (agentKey === "Research" && ["executing", "waiting_for_response", "retrying", "escalated", "proof_pending", "verified", "settled"].includes(status)) return "complete";
  if (agentKey === "Negotiator" && ["waiting_for_response", "retrying", "escalated", "proof_pending", "verified", "settled"].includes(status)) return "complete";
  if (current && match.some((m) => current.includes(m))) return "running";
  return "idle";
}

const STATE_LABEL = {
  complete: { icon: "✓", text: "Complete", class: "text-deputy-accent" },
  running: { icon: "●", text: "Running", class: "text-deputy-warn" },
  waiting: { icon: "○", text: "Waiting", class: "text-deputy-muted" },
  idle: { icon: "○", text: "Idle", class: "text-deputy-muted/50" },
};

export function AgentStates({
  currentAgent,
  status,
}: {
  currentAgent: string | null;
  status: string;
}) {
  return (
    <section className="rounded-xl border border-deputy-border bg-deputy-panel p-5">
      <h2 className="mb-4 text-xs font-medium uppercase tracking-wide text-deputy-muted">
        Mission team
      </h2>
      <div className="grid gap-2 sm:grid-cols-2">
        {AGENTS.map(({ key, match }) => {
          const state = agentState(key, match, currentAgent, status);
          const s = STATE_LABEL[state];
          return (
            <div
              key={key}
              className="flex items-center justify-between rounded-lg bg-deputy-bg/60 px-3 py-2"
            >
              <span className="text-sm">{key}</span>
              <span className={`text-xs ${s.class}`}>
                {s.icon} {s.text}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
