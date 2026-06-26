"use client";

import Link from "next/link";
import clsx from "clsx";
import { ArrowRight } from "lucide-react";

const WORKFLOWS = [
  {
    question: "Where is value?",
    href: "/activity",
    cta: "Open activity",
  },
  {
    question: "Fund contributors",
    href: "/workspace/fund",
    cta: "Fund a project",
  },
  {
    question: "Claim earnings",
    href: "/payments",
    cta: "View payments",
  },
  {
    question: "Connect identity",
    href: "/profile",
    cta: "Open profile",
  },
] as const;

export function WorkflowStrip({ className }: { className?: string }) {
  return (
    <div
      className={clsx(
        "grid gap-2 sm:grid-cols-2 lg:grid-cols-4",
        className,
      )}
    >
      {WORKFLOWS.map((w) => (
        <Link
          key={w.href}
          href={w.href}
          className="group flex items-center justify-between rounded-xl border border-resolve-border/60 bg-resolve-raised/30 px-4 py-3 transition hover:border-resolve-accent/30 hover:bg-resolve-hover/40"
        >
          <span className="text-xs text-resolve-muted group-hover:text-white">{w.question}</span>
          <span className="flex items-center gap-1 text-[11px] font-medium text-resolve-accent">
            {w.cta}
            <ArrowRight className="h-3 w-3 opacity-70 transition group-hover:translate-x-0.5" />
          </span>
        </Link>
      ))}
    </div>
  );
}
