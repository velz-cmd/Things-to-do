export type MissionBriefData = {
  objective: string;
  scope: string;
  status: "analyzing" | "ready" | "error";
  confidence?: number;
  estimatedCapitalUsd?: number;
  affectedCommunities: number;
  evidenceSources: string[];
  capitalAvailableUsd: number;
  capitalRequiredUsd: number;
};

export function MissionBrief({ brief }: { brief: MissionBriefData | null }) {
  if (!brief) {
    return (
      <aside className="hidden w-56 shrink-0 border-r border-resolve-border bg-resolve-bg-deep/20 lg:block xl:w-60">
        <div className="p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-resolve-muted-dim">
            Mission brief
          </p>
          <p className="mt-4 text-sm leading-relaxed text-resolve-muted">
            State an objective above. The brief appears when analysis starts.
          </p>
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden w-56 shrink-0 border-r border-resolve-border bg-resolve-bg-deep/20 lg:block xl:w-60">
      <div className="flex h-full flex-col overflow-y-auto p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-resolve-muted-dim">
          Mission brief
        </p>

        <p className="mt-4 text-sm font-semibold leading-snug text-white">{brief.objective}</p>

        <dl className="mt-6 space-y-4 text-xs">
          <div>
            <dt className="text-resolve-muted-dim">Status</dt>
            <dd className="mt-0.5 font-medium capitalize text-white">{brief.status}</dd>
          </div>
          <div>
            <dt className="text-resolve-muted-dim">Scope</dt>
            <dd className="mt-0.5 text-white">{brief.scope}</dd>
          </div>
          {brief.confidence !== undefined && (
            <div>
              <dt className="text-resolve-muted-dim">Confidence</dt>
              <dd className="mt-0.5 text-white">{Math.round(brief.confidence * 100)}%</dd>
            </div>
          )}
          {brief.estimatedCapitalUsd !== undefined && brief.estimatedCapitalUsd > 0 && (
            <div>
              <dt className="text-resolve-muted-dim">Estimated capital</dt>
              <dd className="mt-0.5 font-medium tabular-nums text-white">
                ${brief.estimatedCapitalUsd.toLocaleString()}
              </dd>
            </div>
          )}
          {brief.affectedCommunities > 0 && (
            <div>
              <dt className="text-resolve-muted-dim">Affected communities</dt>
              <dd className="mt-0.5 text-white">{brief.affectedCommunities}</dd>
            </div>
          )}
        </dl>

        {brief.evidenceSources.length > 0 && (
          <div className="mt-6">
            <p className="text-[10px] font-medium uppercase tracking-wide text-resolve-muted-dim">
              Evidence sources
            </p>
            <ul className="mt-2 space-y-1">
              {brief.evidenceSources.map((s) => (
                <li key={s} className="text-[11px] text-resolve-muted">
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-auto border-t border-resolve-border pt-5">
          <p className="text-[10px] font-medium uppercase tracking-wide text-resolve-muted-dim">
            Capital in scope
          </p>
          <p className="mt-2 text-[11px] text-resolve-muted">
            Available{" "}
            <span className="font-medium tabular-nums text-white">
              ${brief.capitalAvailableUsd.toFixed(2)}
            </span>
          </p>
          {brief.capitalRequiredUsd > 0 && (
            <p className="mt-1 text-[11px] text-resolve-muted">
              Required{" "}
              <span className="font-medium tabular-nums text-amber-200/90">
                ${brief.capitalRequiredUsd.toFixed(2)}
              </span>
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
