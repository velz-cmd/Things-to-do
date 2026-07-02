"use client";

import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, Activity, Banknote, Wallet, User } from "lucide-react";
import { Panel } from "@/components/resolve/ui/panel";

const WORKFLOWS = [
  { question: "Where is value?", href: "/discover", cta: "Open discover", icon: Activity },
  { question: "Fund contributors", href: "/mission", cta: "Open mission", icon: Banknote },
  { question: "Claim earnings", href: "/capital", cta: "View capital", icon: Wallet },
  { question: "Connect identity", href: "/profile", cta: "Open profile", icon: User },
] as const;

export function WorkflowStrip({ className }: { className?: string }) {
  return (
    <div className={clsx("grid gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {WORKFLOWS.map((w) => (
        <Link key={w.href} href={w.href} className="group block">
          <Panel variant="glass" hover className="h-full p-0" padding={false}>
            <div className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/[0.05] ring-1 ring-white/[0.08] transition group-hover:bg-cyan-400/10 group-hover:ring-cyan-400/20">
                  <w.icon className="h-4 w-4 text-resolve-muted transition group-hover:text-cyan-300" />
                </div>
                <ArrowRight className="h-4 w-4 text-resolve-muted opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-cyan-300" />
              </div>
              <p className="mt-4 text-xs text-resolve-muted transition group-hover:text-white/90">
                {w.question}
              </p>
              <p className="mt-1 text-[11px] font-semibold text-cyan-300/80 group-hover:text-cyan-200">
                {w.cta}
              </p>
            </div>
          </Panel>
        </Link>
      ))}
    </div>
  );
}
