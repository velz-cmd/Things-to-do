import Link from "next/link";
import { ArrowRight, Megaphone, Shield, Users } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";

export const metadata = {
  title: "Fediverse campaigns — RESOLVE",
  description:
    "Run transparent donation campaigns for your Mastodon community. Contributors see where every dollar goes.",
};

export default function MastodonCampaignsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10 px-4 py-10">
      <header className="space-y-4 text-center">
        <p className="text-[11px] font-medium uppercase tracking-wider text-resolve-muted">
          For Mastodon &amp; ActivityPub communities
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Campaigns your community can actually trust
        </h1>
        <p className="mx-auto max-w-2xl text-sm leading-relaxed text-resolve-muted">
          Ko-fi and Patreon hide where money goes. RESOLVE runs open campaigns: every payout is tied
          to verified work, batched on a public schedule, and readable by anyone in your instance.
        </p>
        <Link
          href="/missions"
          className="inline-flex items-center gap-2 rounded-md bg-resolve-accent px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Start a campaign
          <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Panel>
          <Megaphone className="mb-2 h-8 w-8 text-resolve-accent" />
          <h2 className="text-base font-semibold text-white">Campaign provider API</h2>
          <p className="mt-2 text-sm text-resolve-muted">
            <code className="text-xs">GET /api/mastodon/campaigns</code> — embed live campaigns in
            your instance&apos;s donation bot or pinned thread.
          </p>
        </Panel>
        <Panel>
          <Users className="mb-2 h-8 w-8 text-resolve-accent" />
          <h2 className="text-base font-semibold text-white">Contributor registry</h2>
          <p className="mt-2 text-sm text-resolve-muted">
            Map ActivityPub actors to payout wallets. Moderators, artists, and builders get paid for
            real contributions.
          </p>
        </Panel>
        <Panel>
          <Shield className="mb-2 h-8 w-8 text-resolve-accent" />
          <h2 className="text-base font-semibold text-white">No black box</h2>
          <p className="mt-2 text-sm text-resolve-muted">
            Supporters see the goal, the budget, and every distribution receipt — not a vague
            &quot;thanks for supporting.&quot;
          </p>
        </Panel>
      </div>

      <Panel>
        <h2 className="text-lg font-semibold text-white">Embed in your instance</h2>
        <p className="mt-1 text-sm text-resolve-muted">
          ActivityPub-friendly JSON for bots and dashboards
        </p>
        <div className="mt-4 space-y-1 font-mono text-xs text-resolve-muted">
          <p>GET https://resolve-task.vercel.app/api/mastodon/campaigns</p>
          <p>GET https://resolve-task.vercel.app/api/mastodon/campaigns/[id]</p>
        </div>
        <p className="mt-4 text-sm text-resolve-muted">
          Also running a music server?{" "}
          <Link href="/music" className="text-resolve-accent hover:underline">
            Navidrome + MusicBrainz payouts
          </Link>
          .
        </p>
      </Panel>
    </div>
  );
}
