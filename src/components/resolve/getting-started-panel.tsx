import Link from "next/link";
import { ArrowRight } from "lucide-react";

const STEPS: Array<{
  done: boolean;
  label: string;
  href: string;
  highlight?: boolean;
}> = [
  { done: true, label: "Install a community on Discover", href: "/discover" },
  { done: true, label: "Connect sensors on Profile (GitHub, ListenBrainz, …)", href: "/profile" },
  { done: true, label: "Fund your program in Capital", href: "/capital" },
  { done: false, label: "Deploy when authorizations appear", href: "/capital" },
  { done: false, label: "Creators collect earnings at Claim", href: "/claim", highlight: true },
];

/** Real onboarding path — ledger-backed programs, not placeholder missions. */
export function GettingStartedPanel() {
  return (
    <section className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
      <p className="text-xs uppercase tracking-wide text-resolve-muted">
        Get started with RESOLVE
      </p>
      <p className="mt-1 text-sm text-white">
        Value is recognized upstream — you approve, fund, and settle on Arc.
      </p>
      <ul className="mt-4 space-y-2">
        {STEPS.map((step) => (
          <li key={step.label} className="flex items-center gap-3 text-sm">
            <span className={step.done ? "text-resolve-accent" : "text-resolve-muted"}>
              {step.done ? "✓" : "○"}
            </span>
            <Link
              href={step.href}
              className={
                step.highlight
                  ? "font-semibold text-resolve-accent hover:underline"
                  : "text-resolve-muted hover:text-white"
              }
            >
              {step.label}
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/discover"
        className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-resolve-accent hover:text-blue-300"
      >
        Browse communities
        <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </section>
  );
}
