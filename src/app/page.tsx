import Link from "next/link";
import { DEPUTY_DOCTRINE } from "@/lib/deputy/types";
import { FUTURE_OUTCOMES } from "@/lib/deputy/ui-types";
import { Card } from "@/components/ui";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-deputy-bg text-white">
      <header className="border-b border-deputy-border">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-semibold">DEPUTY</h1>
          <Link
            href="/app"
            className="rounded-full bg-deputy-accent px-4 py-2 text-sm font-semibold text-deputy-bg"
          >
            Open console
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.25em] text-deputy-muted">
          Lepton · Arc Testnet
        </p>
        <h2 className="mt-4 max-w-2xl text-4xl font-semibold leading-tight">
          Assign the problem. Come back when it&apos;s solved.
        </h2>
        <p className="mt-4 max-w-xl text-lg text-deputy-muted">
          DEPUTY is not pay-per-token. It is{" "}
          <span className="text-deputy-accent">pay-per-resolution</span>. Arc escrow
          unlocks only when proof of outcome is verified.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/app"
            className="rounded-lg bg-deputy-accent px-6 py-3 font-semibold text-deputy-bg"
          >
            Recover $43 airline refund →
          </Link>
          <Link
            href="/merchant"
            className="rounded-lg border border-deputy-border px-6 py-3 text-deputy-muted"
          >
            Merchant demo portal
          </Link>
        </div>

        <section className="mt-16">
          <h3 className="text-sm font-medium uppercase tracking-wide text-deputy-muted">
            Outcome doctrine
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {Object.entries(DEPUTY_DOCTRINE).map(([key, line]) => (
              <Card key={key} className="text-sm text-deputy-muted">
                {line}
              </Card>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <h3 className="text-sm font-medium uppercase tracking-wide text-deputy-muted">
            Coming soon
          </h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {FUTURE_OUTCOMES.map((o) => (
              <Card key={o.title} className="opacity-60">
                <p className="font-medium">{o.title}</p>
                <p className="mt-1 text-xs text-deputy-muted">Landing only — not in MVP</p>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
