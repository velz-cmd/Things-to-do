import Link from "next/link";
import { ArrowRight, Music, Radio, Server, Wallet } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";

export const metadata = {
  title: "Music payouts — RESOLVE",
  description:
    "Register your MusicBrainz artist ID and receive automatic payouts when fans listen on Navidrome or any Subsonic server.",
};

export default function MusicCreatorsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-10">
      <header className="space-y-4 text-center">
        <p className="text-[11px] font-medium uppercase tracking-wider text-resolve-muted">
          For self-hosted music communities
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Get paid when people actually listen
        </h1>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-resolve-muted">
          You run Navidrome (or any Subsonic server). Your listeners already scrobble every play.
          RESOLVE maps those plays to MusicBrainz artists and sends micropayments to wallets you
          control — no new app for fans, no platform lock-in.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/missions?panel=registry"
            className="inline-flex items-center gap-2 rounded-md bg-resolve-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Register your artist ID
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/docs/DISTRIBUTION.md"
            className="inline-flex items-center gap-2 rounded-md border border-resolve-border-strong px-5 py-2.5 text-sm text-white hover:bg-resolve-hover"
          >
            Sidecar setup
          </Link>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Panel>
          <Music className="mb-2 h-8 w-8 text-resolve-accent" />
          <h2 className="text-base font-semibold text-white">MusicBrainz Payee Registry</h2>
          <p className="mt-2 text-sm text-resolve-muted">
            Link your MBID to a payout wallet once. Every verified play routes to you automatically.
          </p>
        </Panel>
        <Panel>
          <Radio className="mb-2 h-8 w-8 text-resolve-accent" />
          <h2 className="text-base font-semibold text-white">Navidrome sidecar</h2>
          <p className="mt-2 text-sm text-resolve-muted">
            A tiny webhook on scrobble events. Fans keep using Finamp, Symfonium, or whatever they
            already have.
          </p>
        </Panel>
        <Panel>
          <Wallet className="mb-2 h-8 w-8 text-resolve-accent" />
          <h2 className="text-base font-semibold text-white">Transparent splits</h2>
          <p className="mt-2 text-sm text-resolve-muted">
            Payouts batch on a schedule you set. Contributors see exactly what they earned and why.
          </p>
        </Panel>
      </div>

      <Panel>
        <div className="flex items-center gap-2">
          <Server className="h-5 w-5 text-resolve-accent" />
          <h2 className="text-lg font-semibold text-white">Self-host in three steps</h2>
        </div>
        <p className="mt-1 text-sm text-resolve-muted">
          No vendor lock-in. Works with your existing stack.
        </p>
        <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm text-resolve-muted">
          <li>
            <strong className="text-white">Register</strong> — POST your MusicBrainz ID + wallet to{" "}
            <code className="rounded bg-resolve-hover px-1 text-xs text-white">
              /api/registry/musicbrainz/[mbid]
            </code>
          </li>
          <li>
            <strong className="text-white">Point scrobbles</strong> — forward Navidrome scrobble
            events to{" "}
            <code className="rounded bg-resolve-hover px-1 text-xs text-white">
              /api/sidecar/scrobble
            </code>
          </li>
          <li>
            <strong className="text-white">Fund &amp; distribute</strong> — deposit to your treasury;
            RESOLVE batches payouts on your cadence
          </li>
        </ol>
        <p className="mt-4 text-sm text-resolve-muted">
          Running a Mastodon instance?{" "}
          <Link href="/mastodon" className="text-resolve-accent hover:underline">
            Campaign provider for the fediverse
          </Link>
          .
        </p>
      </Panel>
    </div>
  );
}
