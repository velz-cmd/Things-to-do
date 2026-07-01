"use client";

import Link from "next/link";
import { ArrowRight, Bot, Sparkles } from "lucide-react";
import { DiscoverPremiumSection } from "@/components/resolve/discover/discover-premium-section";
import { DiscoverCapitalCard } from "@/components/resolve/discover/discover-capital-card";
import { PLATFORM_LOOP_TAGLINE } from "@/lib/economy/platform-loop";
import { formatAgentPrice } from "@/lib/agent/agent-signal-format";

const EXAMPLE_SIGNALS = [
  {
    label: "Docs review",
    prompt: "Run intel on React maintainers — docs gaps and contributor health",
    price: 0.02,
  },
  {
    label: "Sentiment",
    prompt: "Classify sentiment for maintainer feedback: love the DX but docs lag behind releases.",
    price: 0.001,
  },
  {
    label: "Citation verify",
    prompt: "Verify citation 10.1038/nature12373 in this open-science reuse summary.",
    price: 0.003,
  },
  {
    label: "Security signal",
    prompt: "Extract CVEs from this advisory: critical RCE in libxml2 before 2.12.0.",
    price: 0.1,
  },
] as const;

/** Discover Signals lane — routes agent intel to Mission chat. */
export function DiscoverSignalsMissionCta({ signedIn }: { signedIn: boolean }) {
  return (
    <DiscoverPremiumSection
      id="agent-market"
      title="Agent signals"
      subtitle="Hire agents in Mission — chat-first, pay-per-signal on Arc"
      className="mb-10 scroll-mt-24"
    >
      <div className="space-y-5">
        <p className="rounded-xl border border-violet-500/20 bg-violet-500/[0.06] px-4 py-3 text-center text-sm font-medium leading-relaxed text-violet-100/95">
          {PLATFORM_LOOP_TAGLINE}
        </p>

        <DiscoverCapitalCard padding={false}>
          <div className="p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-resolve-accent/25 bg-resolve-accent/[0.08]">
                <Bot className="h-5 w-5 text-resolve-accent" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">Run intel in Mission</p>
                <p className="mt-1 text-xs leading-relaxed text-resolve-muted">
                  Type what you need — Mission suggests the right signal, shows what you get, charges
                  your wallet, and returns a full execution report with next steps.
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-2">
              {[
                "Docs quality score and maintainer next steps",
                "Wallet debit with receipt proof",
                "Follow-up actions — fund, install programs, continue",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-xs text-resolve-muted">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  {item}
                </li>
              ))}
            </ul>

            <Link
              href="/mission"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-resolve-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-resolve-accent/90"
            >
              Open Mission
              <ArrowRight className="h-4 w-4" />
            </Link>
            {!signedIn && (
              <p className="mt-2 text-[11px] text-resolve-muted-dim">
                Sign in to run paid agent signals from your wallet.
              </p>
            )}
          </div>
        </DiscoverCapitalCard>

        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-resolve-muted-dim">
            Example prompts
          </p>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2">
            {EXAMPLE_SIGNALS.map((ex) => (
              <li key={ex.label}>
                <Link
                  href={`/mission?prompt=${encodeURIComponent(ex.prompt)}`}
                  className="block rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition hover:border-resolve-accent/25 hover:bg-resolve-accent/[0.04]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-white">{ex.label}</p>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-emerald-300">
                      {formatAgentPrice(ex.price)}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] text-resolve-muted">{ex.prompt}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </DiscoverPremiumSection>
  );
}
