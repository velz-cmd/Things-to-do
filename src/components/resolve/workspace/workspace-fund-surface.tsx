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
        <nav className="flex rounded-2xl resolve-glass-subtle p-1 ring-1 ring-white/[0.06]">
          {MODES.map((m) => {
            const active = m.exact ? pathname === m.href : pathname.startsWith(m.href);
            return (
              <Link
                key={m.href}
                href={m.href}
                className={clsx(
                  "rounded-xl px-4 py-2 text-xs font-semibold transition-all duration-300",
                  active ?
                    "resolve-accent-gradient text-white shadow-resolve-glow"
                  : "text-resolve-muted hover:bg-white/[0.06] hover:text-white",
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
