"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Banknote } from "lucide-react";
import { ProductPage } from "@/components/resolve/layout/product-page";
import { WorkspaceFund } from "@/components/resolve/workspace/workspace-fund";

const MODES = [
  { href: "/workspace", label: "Command", exact: true },
  { href: "/workspace/fund", label: "Fund", exact: false },
] as const;

/** Discover projects, analyze attribution, authorize settlement. */
export function WorkspaceFundSurface() {
  const pathname = usePathname();

  return (
    <ProductPage
      icon={Banknote}
      title="Fund contributors"
      description="Discover open-source work, run evidence-backed attribution, and authorize settlement from treasury. Every step requires your approval."
      workflows={[
        { label: "Discover" },
        { label: "Attribute" },
        { label: "Authorize" },
        { label: "Settle", href: "/payments" },
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
      accent="violet"
    >
      <WorkspaceFund />
    </ProductPage>
  );
}
