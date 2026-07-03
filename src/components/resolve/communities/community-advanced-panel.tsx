"use client";

import { CapitalFlowImpact } from "@/components/resolve/communities/capital-flow-impact";
import { CommunityObservatory } from "@/components/resolve/communities/community-observatory";
import { CommunityGraphObservatory } from "@/components/resolve/communities/community-graph-observatory";
import { CommunityLiveAuthorizations } from "@/components/resolve/communities/community-live-authorizations";
import { EconomicMemoryTimeline } from "@/components/resolve/communities/economic-memory-timeline";
import { MeasureLearnPanel } from "@/components/resolve/communities/measure-learn-panel";
import type { CommunitySurface } from "@/lib/communities/types";

type Props = {
  slug: string;
  surface: CommunitySurface;
  onRefresh: () => void;
};

export function CommunityAdvancedPanel({ slug, surface, onRefresh }: Props) {
  return (
    <div id="advanced" className="scroll-mt-24 space-y-8">
      {surface.observatory && surface.observatory.length > 0 && (
        <CommunityObservatory alerts={surface.observatory} />
      )}

      <CommunityGraphObservatory slug={slug} />

      {surface.impact && <CapitalFlowImpact impact={surface.impact} />}

      <div id="events" className="scroll-mt-24">
        <CommunityLiveAuthorizations slug={slug} />
      </div>

      {surface.programs.map((p) => (
        <MeasureLearnPanel
          key={`ml-${p.id}`}
          slug={slug}
          programId={p.id}
          onUpdated={onRefresh}
        />
      ))}

      <EconomicMemoryTimeline entries={surface.economicMemory ?? []} />

      {surface.timeline && surface.timeline.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-white">Community history</h2>
          <p className="mt-1 text-xs text-resolve-muted">Installs, authorizations, Arc receipts</p>
          <ul className="mt-4 divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
            {surface.timeline.slice(0, 8).map((ev) => (
              <li key={ev.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm text-white">{ev.title}</p>
                  {ev.detail && <p className="mt-0.5 text-xs text-resolve-muted">{ev.detail}</p>}
                </div>
                <time className="shrink-0 text-[10px] text-resolve-muted-dim">
                  {new Date(ev.createdAt).toLocaleDateString()}
                </time>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
