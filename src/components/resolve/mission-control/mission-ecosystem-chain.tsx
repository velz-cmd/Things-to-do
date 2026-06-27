import type { ValueConcentration } from "@/lib/workspace/advisors/concentrations";

/** Mission-scoped ecosystem chain — only when a mission is active. */
export function MissionEcosystemChain({
  scope,
  concentrations,
}: {
  scope: string;
  concentrations: ValueConcentration[];
}) {
  const scoped = concentrations.filter(
    (c) =>
      c.title.toLowerCase().includes(scope.toLowerCase().split("/")[0] ?? "") ||
      c.detail.toLowerCase().includes(scope.toLowerCase()),
  );
  const nodes =
    scoped.length > 0
      ? scoped.slice(0, 5).map((c) => c.title)
      : concentrations.slice(0, 4).map((c) => c.title);

  if (nodes.length === 0) return null;

  const chain = [scope, ...nodes, "Funding paths"];

  return (
    <div className="border-b border-resolve-border/60 px-4 py-4 lg:px-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-resolve-muted-dim">
        Ecosystem scope
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-resolve-muted">
        {chain.map((node, i) => (
          <span key={`${node}-${i}`} className="flex items-center gap-2">
            {i > 0 && <span className="text-resolve-muted-dim">↓</span>}
            <span className={i === 0 ? "font-medium text-white" : ""}>{node}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
