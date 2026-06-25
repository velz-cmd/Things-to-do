import Link from "next/link";
import {
  DECENTRALIZATION,
  PROTOCOL_GAPS,
  RESOLVE_PROTOCOL,
} from "@/lib/protocol/resolve-protocol";
import { Panel } from "@/components/resolve/ui/panel";

export const metadata = {
  title: "Protocol — RESOLVE Open Impact Settlement",
  description:
    "Open-source protocol for discovering unpaid value, weighting heterogeneous contributions, and settling proportional splits on Arc.",
};

export default function ProtocolPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-10">
      <header className="space-y-3">
        <p className="text-[11px] font-medium uppercase tracking-wider text-resolve-muted">
          {RESOLVE_PROTOCOL.version} · MIT · open source
        </p>
        <h1 className="text-3xl font-semibold text-white">{RESOLVE_PROTOCOL.name}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-resolve-muted">
          A decentralized valuation layer for <strong className="text-white">any</strong> contribution
          graph — code, music, streams, photos, posts. Discover who is unpaid, weight impact with
          published proofs, settle proportionally on Arc. Not a registry. Not a market. A protocol.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link href="/discover" className="text-resolve-accent hover:underline">
            Unpaid Value Index →
          </Link>
          <Link href="/weight" className="text-resolve-accent hover:underline">
            Proof-of-Weight →
          </Link>
          <Link href="/docs/PROTOCOL.md" className="text-resolve-accent hover:underline">
            Full spec
          </Link>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {RESOLVE_PROTOCOL.primitives.map((p) => (
          <Panel key={p.id} className="p-4">
            <p className="text-[10px] font-mono uppercase text-resolve-accent">{p.id}</p>
            <h2 className="mt-1 text-base font-semibold text-white">{p.name}</h2>
            <p className="mt-1 text-[10px] uppercase text-resolve-muted">{p.verb}</p>
            <p className="mt-2 text-xs text-resolve-muted">{p.description}</p>
          </Panel>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Problems only this protocol solves</h2>
        <ul className="space-y-3">
          {PROTOCOL_GAPS.map((g) => (
            <li key={g.problem}>
              <Panel className="p-4">
                <p className="text-sm font-medium text-white">{g.problem}</p>
                <p className="mt-1 text-xs text-resolve-muted">{g.whyOthersFail}</p>
                <p className="mt-2 text-xs text-emerald-300/90">→ {g.resolve}</p>
              </Panel>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Decentralization</h2>
        <Panel className="space-y-2 p-4 font-mono text-xs text-resolve-muted">
          {Object.entries(DECENTRALIZATION).map(([k, v]) => (
            <p key={k}>
              <span className="text-white">{k}</span>: {v}
            </p>
          ))}
        </Panel>
      </section>
    </div>
  );
}
