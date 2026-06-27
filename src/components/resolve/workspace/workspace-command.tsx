"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LayoutGrid } from "lucide-react";
import { ProductPage } from "@/components/resolve/layout/product-page";
import { WorkspaceProtocol } from "@/components/resolve/workspace/workspace-protocol";

const MODES = [
  { href: "/workspace", label: "Command", exact: true },
  { href: "/workspace/fund", label: "Allocate", exact: false },
] as const;

/** Open Capital Workspace — observe, reason, allocate, settle. */
export function WorkspaceCommand() {
  const pathname = usePathname();

  return (
    <ProductPage
      icon={LayoutGrid}
      title="Workspace"
      description="Capital flow infrastructure for open ecosystems. Value is discovered where people already work — you reason, approve, and settle."
      workflows={[
        { label: "Value network", active: pathname === "/workspace" },
        { label: "Command", active: pathname === "/workspace" },
        { label: "Capital", href: "/payments" },
        { label: "Activity", href: "/activity" },
      ]}
      actions={
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
      }
      width="wide"
      accent="blue"
    >
      <WorkspaceProtocol />
    </ProductPage>
  );
}
