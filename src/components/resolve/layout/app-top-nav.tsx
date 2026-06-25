"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Banknote, Gift, Home, GitBranch, LayoutList, Radar, Search, Scale } from "lucide-react";
import { AuthHeader } from "@/components/auth/auth-header";

const NAV = [
  { href: "/", label: "Home", icon: Home, exact: true },
  { href: "/blueprint", label: "Blueprint", icon: GitBranch },
  { href: "/radar", label: "Radar", icon: Radar },
  { href: "/weight", label: "Weight", icon: Scale },
  { href: "/settle", label: "Settle", icon: Banknote },
  { href: "/claim", label: "Claim", icon: Gift },
  { href: "/discover", label: "Discover", icon: Search },
  { href: "/methodology", label: "Signals", icon: LayoutList },
];

export function AppTopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-resolve-border bg-resolve-bg/95 backdrop-blur">
      <div className="mx-auto flex h-12 max-w-7xl items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="shrink-0">
            <p className="text-sm font-semibold tracking-tight text-white">RESOLVE</p>
            <p className="text-[10px] text-resolve-muted-dim">Capital flow · GitHub first</p>
          </Link>

          <nav className="flex items-center gap-1">
            {NAV.map((item) => {
              const active = item.exact
                ? pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition",
                    active
                      ? "bg-resolve-hover text-white"
                      : "text-resolve-muted hover:bg-resolve-hover/60 hover:text-white",
                  )}
                >
                  <Icon className="h-3.5 w-3.5 opacity-80" strokeWidth={1.5} />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <AuthHeader />
      </div>
    </header>
  );
}
