import clsx from "clsx";
import { AGENT_PIPELINE } from "@/lib/deputy/ui-types";

export function AgentPipeline({ activeAgent }: { activeAgent: string | null }) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-deputy-muted">
        Agent team
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {AGENT_PIPELINE.map((agent, i) => (
          <div key={agent} className="flex items-center gap-2">
            <span
              className={clsx(
                "rounded-full px-2.5 py-1 text-xs transition-all",
                activeAgent === agent
                  ? "bg-deputy-accent/20 text-deputy-accent ring-2 ring-deputy-accent/50 scale-105"
                  : "bg-deputy-bg text-deputy-muted"
              )}
            >
              {agent}
            </span>
            {i < AGENT_PIPELINE.length - 1 && (
              <span className="text-deputy-border">→</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
