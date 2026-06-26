"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { AuthHeader } from "@/components/auth/auth-header";
import { PRODUCT_NAV } from "@/components/resolve/layout/nav";

export function ResolveLogo({ className }: { className?: string }) {
  return (
    <Link href="/" className={clsx("group flex items-center gap-2.5", className)}>
      <span className="flex h-7 w-7 items-center justify-center rounded-lg resolve-accent-gradient shadow-resolve-accent">
        <span className="text-[11px] font-bold text-white">R</span>
      </span>
      <span className="text-sm font-semibold tracking-tight text-white">RESOLVE</span>
    </Link>
  );
}

export function ProductNav({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      className={clsx(
        "flex items-center gap-0.5 rounded-resolve-lg border border-resolve-border bg-resolve-raised/60 p-1",
        compact && "hidden sm:flex",
      )}
    >
      {PRODUCT_NAV.map((item) => {
        const active =
          item.exact ?
            pathname === item.href
          : pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition",
              active ?
                "bg-white/10 text-white shadow-sm"
              : "text-resolve-muted hover:text-white",
            )}
          >
            <Icon className="h-3.5 w-3.5 opacity-90" strokeWidth={1.5} />
            {!compact && item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppTopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-resolve-border/80 resolve-glass-subtle">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between gap-4 px-4 lg:px-6">
        <div className="flex items-center gap-5">
          <ResolveLogo />
          <ProductNav />
        </div>
        <AuthHeader />
      </div>
    </header>
  );
}

export function MarketingTopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-resolve-border/60 resolve-glass-subtle">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <ResolveLogo />
        <div className="flex items-center gap-4">
          <nav className="hidden items-center gap-1 md:flex">
            {PRODUCT_NAV.map((item) => {
              const active =
                item.exact ?
                  pathname === item.href
                : pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                    active ? "text-white" : "text-resolve-muted hover:text-white",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <Link
            href="/workspace"
            className="hidden rounded-resolve resolve-accent-gradient px-4 py-2 text-xs font-semibold text-white shadow-resolve-accent sm:inline-flex"
          >
            Open workspace
          </Link>
          <AuthHeader />
        </div>
      </div>
    </header>
  );
}
