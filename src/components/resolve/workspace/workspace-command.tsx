"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { LayoutGrid } from "lucide-react";
import { ProductPage } from "@/components/resolve/layout/product-page";
import { WorkflowStrip } from "@/components/resolve/layout/workflow-strip";
import { WorkspaceProtocol } from "@/components/resolve/workspace/workspace-protocol";

const MODES = [
  { href: "/workspace", label: "Command", exact: true },
  { href: "/workspace/fund", label: "Fund", exact: false },
] as const;

/** AI-native mission control — chat, intelligence, manual policies. */
export function WorkspaceCommand() {
  const pathname = usePathname();

  return (
    <ProductPage
      icon={LayoutGrid}
      title="Workspace"
      description="Ask where value is. Propose policies. Approve everything. This is your protocol command center — not a dashboard."
      workflows={[
        { label: "AI reasoning", active: pathname === "/workspace" },
        { label: "Manual control" },
        { label: "Value concentrations" },
      ]}
      actions={
        <nav className="flex rounded-resolve-lg border border-resolve-border/60 bg-resolve-raised/50 p-1">
          {MODES.map((m) => {
            const active = m.exact ? pathname === m.href : pathname.startsWith(m.href);
            return (
              <Link
                key={m.href}
                href={m.href}
                className={clsx(
                  "rounded-lg px-3.5 py-1.5 text-xs font-semibold transition",
                  active ? "bg-white/10 text-white shadow-sm" : "text-resolve-muted hover:text-white",
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
      <div className="space-y-8">
        <WorkspaceProtocol />
        <WorkflowStrip />
      </div>
    </ProductPage>
  );
}
