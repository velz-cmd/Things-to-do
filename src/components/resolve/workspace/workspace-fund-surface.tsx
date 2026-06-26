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
        <nav className="flex rounded-lg border border-resolve-border/60 p-0.5">
          {MODES.map((m) => {
            const active = m.exact ? pathname === m.href : pathname.startsWith(m.href);
            return (
              <Link
                key={m.href}
                href={m.href}
                className={clsx(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition",
                  active ? "bg-white/10 text-white" : "text-resolve-muted hover:text-white",
                )}
              >
                {m.label}
              </Link>
            );
          })}
        </nav>
      }
      width="wide"
    >
      <WorkspaceFund />
    </ProductPage>
  );
}
