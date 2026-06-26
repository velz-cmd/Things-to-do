"use client";

import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, Activity, Banknote, Wallet, User } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";

const WORKFLOWS = [
  {
    question: "Where is value?",
    href: "/activity",
    cta: "Open activity",
    icon: Activity,
    tone: "sky" as const,
  },
  {
    question: "Fund contributors",
    href: "/workspace/fund",
    cta: "Fund a project",
    icon: Banknote,
    tone: "violet" as const,
  },
  {
    question: "Claim earnings",
    href: "/payments",
    cta: "View payments",
    icon: Wallet,
    tone: "emerald" as const,
  },
  {
    question: "Connect identity",
    href: "/profile",
    cta: "Open profile",
    icon: User,
    tone: "amber" as const,
  },
] as const;

const toneBorder = {
  sky: "hover:border-sky-500/30 group-hover:text-sky-300",
  violet: "hover:border-violet-500/30 group-hover:text-violet-300",
  emerald: "hover:border-emerald-500/30 group-hover:text-emerald-300",
  amber: "hover:border-amber-500/30 group-hover:text-amber-300",
};

export function WorkflowStrip({ className }: { className?: string }) {
  return (
    <div className={clsx("grid gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {WORKFLOWS.map((w) => (
        <Link key={w.href} href={w.href} className="group">
          <Panel
            variant="glass"
            className={clsx("h-full p-4 transition", toneBorder[w.tone])}
            padding={false}
          >
            <div className="p-4">
              <div className="flex items-center justify-between">
                <w.icon className="h-4 w-4 text-resolve-muted group-hover:text-resolve-accent" />
                <ArrowRight className="h-3.5 w-3.5 text-resolve-muted opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
              </div>
              <p className="mt-3 text-xs text-resolve-muted group-hover:text-white">{w.question}</p>
              <p className="mt-1 text-[11px] font-semibold text-resolve-accent">{w.cta}</p>
            </div>
          </Panel>
        </Link>
      ))}
    </div>
  );
}
