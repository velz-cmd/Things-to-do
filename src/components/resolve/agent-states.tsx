import clsx from "clsx";

const AGENTS = [
  {
    key: "Planner",
    role: "Breaks the outcome into steps",
    match: ["Planner", "planning", "created", "authorized"],
    color: "from-violet-500/20 to-violet-500/5",
    dot: "bg-violet-400",
  },
  {
    key: "Research",
    role: "Finds bookings, receipts, policy",
    match: ["Evidence", "evidence_gathering"],
    color: "from-sky-500/20 to-sky-500/5",
    dot: "bg-sky-400",
  },
  {
    key: "Negotiator",
    role: "Contacts merchant & follows up",
    match: ["Executor", "executing"],
    color: "from-amber-500/20 to-amber-500/5",
    dot: "bg-amber-400",
  },
  {
    key: "Verifier",
    role: "Checks proof before payout",
    match: ["Verification", "proof_pending", "verified", "settled"],
    color: "from-emerald-500/20 to-emerald-500/5",
    dot: "bg-emerald-400",
  },
  {
    key: "Escalation",
    role: "Formal dispute if blocked",
    match: [
      "Escalation",
      "escalated",
      "Retry",
      "retrying",
      "waiting_for_response",
    ],
    color: "from-rose-500/20 to-rose-500/5",
    dot: "bg-rose-400",
  },
] as const;

function agentState(
  agentKey: string,
  match: string[],
  current: string | null,
  status: string
): "complete" | "running" | "waiting" | "idle" {
  if (current && match.includes(current)) return "running";
  if (agentKey === "Verifier" && ["verified", "settled"].includes(status))
    return "complete";
  if (agentKey === "Escalation" && status === "escalated") return "running";
  if (agentKey === "Planner" && !["created"].includes(status)) return "complete";
  if (
    agentKey === "Research" &&
    [
      "executing",
      "waiting_for_response",
      "retrying",
      "escalated",
      "proof_pending",
      "verified",
      "settled",
    ].includes(status)
  )
    return "complete";
  if (
    agentKey === "Negotiator" &&
    [
      "waiting_for_response",
      "retrying",
      "escalated",
      "proof_pending",
      "verified",
      "settled",
    ].includes(status)
  )
    return "complete";
  if (current && match.some((m) => current.includes(m))) return "running";
  return "idle";
}

const STATE_STYLES = {
  complete: {
    label: "Complete",
    pill: "bg-deputy-accent/15 text-deputy-accent border-deputy-accent/30",
  },
  running: {
    label: "Running",
    pill: "bg-deputy-warn/15 text-deputy-warn border-deputy-warn/40 animate-pulse",
  },
  waiting: {
    label: "Waiting",
    pill: "bg-slate-700/40 text-slate-300 border-slate-600/50",
  },
  idle: {
    label: "Standby",
    pill: "bg-deputy-bg text-slate-400 border-deputy-border",
  },
};

export function AgentStates({
  currentAgent,
  status,
}: {
  currentAgent: string | null;
  status: string;
}) {
  const running = AGENTS.filter(
    ({ key, match }) => agentState(key, [...match], currentAgent, status) === "running"
  ).length;

  return (
    <section className="overflow-hidden rounded-2xl border border-deputy-border bg-gradient-to-b from-deputy-panel to-deputy-panel/80 shadow-lg shadow-black/20">
      <div className="flex items-center justify-between border-b border-deputy-border/80 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-white">Mission team</h2>
          <p className="mt-0.5 text-xs text-deputy-muted">
            Specialized agents working your outcome
          </p>
        </div>
        {running > 0 && (
          <span className="rounded-full bg-deputy-warn/15 px-2.5 py-1 text-xs font-medium text-deputy-warn">
            {running} active
          </span>
        )}
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2">
        {AGENTS.map(({ key, role, match, color, dot }) => {
          const state = agentState(key, [...match], currentAgent, status);
          const s = STATE_STYLES[state];

          return (
            <div
              key={key}
              className={clsx(
                "rounded-xl border border-deputy-border/60 bg-gradient-to-br p-4 transition",
                color,
                state === "running" && "ring-1 ring-deputy-warn/30"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={clsx(
                      "h-2.5 w-2.5 shrink-0 rounded-full",
                      dot,
                      state === "running" && "animate-pulse"
                    )}
                  />
                  <div>
                    <p className="text-sm font-semibold text-white">{key}</p>
                    <p className="mt-0.5 text-xs leading-snug text-slate-400">
                      {role}
                    </p>
                  </div>
                </div>
                <span
                  className={clsx(
                    "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
                    s.pill
                  )}
                >
                  {s.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
