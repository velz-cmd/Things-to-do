import Link from "next/link";
import { METHODOLOGY_SIGNALS } from "@/lib/weight/signals";
import { Panel } from "@/components/resolve/ui/panel";

export const metadata = {
  title: "Signals — RESOLVE Proof-of-Weight",
  description: "Seven open signals for scoring heterogeneous contributions before settlement.",
};

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-10">
      <header className="space-y-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-resolve-muted">
          Methodology
        </p>
        <h1 className="text-3xl font-semibold text-white">Seven signals. One verdict.</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-resolve-muted">
          RESOLVE does not pay per CSV row. It weights verified impact — then splits a fund pool
          proportionally. Every settlement links to a hash of the AI reasoning (weight proof).
        </p>
        <Link href="/weight" className="inline-block text-sm text-resolve-accent hover:underline">
          Open Proof-of-Weight →
        </Link>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-white">The signal stack</h2>
        {METHODOLOGY_SIGNALS.filter((s) => s.defaultWeight > 0).map((signal, i) => (
          <Panel key={signal.id} className="p-4">
            <p className="text-[10px] font-medium uppercase text-resolve-muted">
              {String(i + 1).padStart(2, "0")} / 07 · weight {(signal.defaultWeight * 100).toFixed(0)}%
            </p>
            <h3 className="mt-1 text-base font-semibold text-white">{signal.label}</h3>
            <p className="mt-2 text-sm text-resolve-muted">
              {signal.id === "engagement_depth" &&
                "Listen duration, chat presence, repeat engagement — not raw event counts."}
              {signal.id === "contribution_complexity" &&
                "PR diff size, files touched, test coverage — complex fixes score higher than typo patches."}
              {signal.id === "consistency" &&
                "Sustained contribution patterns vs one-off spikes."}
              {signal.id === "community_endorsement" &&
                "Review comments, maintainer merges, downstream usage."}
              {signal.id === "proof_integrity" &&
                "Policy verification — scrobble floor, merge proof, EXIF attestation."}
              {signal.id === "reach_proxy" &&
                "Shares, viewers, dependents — proxy for value created beyond the contributor."}
            </p>
          </Panel>
        ))}
        <Panel className="border-red-500/20 p-4">
          <p className="text-[10px] font-medium uppercase text-red-300/80">Penalty signal</p>
          <h3 className="mt-1 text-base font-semibold text-white">Suspicion penalty</h3>
          <p className="mt-2 text-sm text-resolve-muted">
            Bot traffic, sub-30s scrobbles, flagged patterns — subtracts from composite score.
          </p>
        </Panel>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Composite → settlement</h2>
        <Panel className="p-4 font-mono text-xs text-resolve-muted">
          <p>1. Ingest raw contribution graph (PRs, scrobbles, streams, photos)</p>
          <p>2. Score each event 1–100 across seven signals</p>
          <p>3. Aggregate weight per contributor</p>
          <p>4. Founder reviews impact breakdown + AI rationale</p>
          <p>5. Batch-settle proportional USDC on Arc with weight proof hash</p>
        </Panel>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Open Contribution Graph</h2>
        <p className="text-sm text-resolve-muted">
          One valuation engine for any event type — not a single-community sidecar.
        </p>
        <Panel className="grid gap-2 p-4 text-xs text-resolve-muted sm:grid-cols-2">
          <p>· GitHub merges &amp; reviews</p>
          <p>· Navidrome / Subsonic scrobbles</p>
          <p>· Owncast / stream presence</p>
          <p>· Immich EXIF attribution</p>
          <p>· Mastodon citations &amp; boosts</p>
          <p>· Bounties &amp; deliverables</p>
        </Panel>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Protocol vs flat payrails</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-resolve-border text-resolve-muted">
                <th className="py-2 pr-4">Others</th>
                <th className="py-2">RESOLVE</th>
              </tr>
            </thead>
            <tbody className="text-resolve-muted">
              <tr className="border-b border-resolve-border/60">
                <td className="py-2 pr-4">Pay per event (flat CSV)</td>
                <td className="py-2 text-white">Pay per verified impact (weighted split)</td>
              </tr>
              <tr className="border-b border-resolve-border/60">
                <td className="py-2 pr-4">Count scrobbles / PRs</td>
                <td className="py-2 text-white">Score why this one mattered more</td>
              </tr>
              <tr>
                <td className="py-2 pr-4">Treasury dashboard</td>
                <td className="py-2 text-white">Discovery → weight → settle (one loop)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-resolve-muted">
        Full spec:{" "}
        <Link href="/protocol" className="text-resolve-accent hover:underline">
          Open Impact Settlement Protocol
        </Link>
      </p>
    </div>
  );
}
