"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { WorkspaceFund } from "@/components/resolve/workspace/workspace-fund";

const MODES = [
  { href: "/control", label: "Understand", exact: false },
  { href: "/decide", label: "Decide", exact: false },
] as const;

/** Decide — what needs funding? Evidence-backed allocation. */
export function WorkspaceFundSurface() {
  const pathname = usePathname();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 lg:px-8">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
            Decide
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-white">What needs funding?</h1>
          <p className="mt-2 max-w-xl text-sm text-resolve-muted">
            Help me distribute this correctly — analyze attribution, authorize settlement. Every
            step requires your approval.
          </p>
        </div>
        <nav className="flex rounded-lg border border-resolve-border p-1">
          {MODES.map((m) => {
            const active = m.exact ? pathname === m.href : pathname.startsWith(m.href);
            return (
              <Link
                key={m.href}
                href={m.href}
                className={clsx(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition",
                  active
                    ? "bg-resolve-accent/15 text-white"
                    : "text-resolve-muted hover:text-white",
                )}
              >
                {m.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <WorkspaceFund />
    </div>
  );
}
