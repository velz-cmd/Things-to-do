"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { WorkspaceOS } from "@/components/resolve/workspace/workspace-os";

const MODES = [
  { href: "/workspace", label: "Observe", exact: true },
  { href: "/workspace/fund", label: "Allocate", exact: false },
] as const;

/**
 * Economic Operating System for open ecosystems.
 * One engine · many sensors · two interfaces (reason + manual).
 */
export function WorkspaceCommand() {
  const pathname = usePathname();

  return (
    <div className="relative mx-auto max-w-6xl px-4 py-8 lg:px-8">
      <header className="mb-10 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
            Universal settlement engine
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Workspace</h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-resolve-muted">
            Where value already flows across open economies — observe, reason, authorize, settle.
            Connectors are sensors. Capital is the product.
          </p>
        </div>
        <nav className="flex rounded-2xl resolve-glass-subtle p-1 ring-1 ring-resolve-border">
          {MODES.map((m) => {
            const active = m.exact ? pathname === m.href : pathname.startsWith(m.href);
            return (
              <Link
                key={m.href}
                href={m.href}
                className={clsx(
                  "rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-300",
                  active
                    ? "resolve-accent-gradient text-white shadow-resolve-glow"
                    : "text-resolve-muted hover:bg-resolve-accent/10 hover:text-white",
                )}
              >
                {m.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <WorkspaceOS />
    </div>
  );
}
