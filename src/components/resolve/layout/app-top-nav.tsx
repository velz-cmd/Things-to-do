"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { AuthHeader } from "@/components/auth/auth-header";
import { PRODUCT_NAV } from "@/components/resolve/layout/nav";

export function ResolveLogo({ className }: { className?: string }) {
  return (
    <Link href="/" className={clsx("group flex items-center gap-2.5", className)}>
      <span className="relative flex h-8 w-8 items-center justify-center rounded-xl resolve-accent-gradient shadow-resolve-glow transition group-hover:scale-105">
        <span className="text-xs font-bold text-white">R</span>
        <span className="absolute inset-0 rounded-xl bg-resolve-accent/25 blur-md opacity-0 transition group-hover:opacity-100" />
      </span>
      <span className="text-sm font-semibold tracking-[0.08em] text-white">RESOLVE</span>
    </Link>
  );
}

export function ProductNav({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      className={clsx(
        "flex items-center gap-0.5 rounded-2xl resolve-glass-subtle p-1 shadow-resolve",
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
              "relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-[12px] font-medium transition-all duration-300",
              active ?
                "bg-resolve-accent/15 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ring-1 ring-resolve-accent/25"
              : "text-resolve-muted hover:bg-resolve-accent/10 hover:text-white",
            )}
          >
            {active && (
              <span className="absolute inset-x-3 -bottom-px h-px bg-gradient-to-r from-transparent via-resolve-accent-bright/60 to-transparent" />
            )}
            <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
            {!compact && item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppTopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-resolve-border resolve-glass-subtle">
      <div className="mx-auto flex h-[3.75rem] max-w-[1400px] items-center justify-between gap-4 px-4 lg:px-8">
        <div className="flex items-center gap-6">
          <ResolveLogo />
          <ProductNav />
        </div>
        <AuthHeader />
      </div>
    </header>
  );
}

export function MarketingTopNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-resolve-border/80 resolve-glass-subtle">
      <div className="mx-auto flex h-[3.75rem] max-w-6xl items-center justify-between px-6 lg:px-8">
        <ResolveLogo />
        <div className="flex items-center gap-5">
          <nav className="hidden items-center gap-1 rounded-2xl resolve-glass-subtle p-1 md:flex">
            {PRODUCT_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl px-3.5 py-2 text-xs font-medium text-resolve-muted transition hover:bg-resolve-accent/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <Link href="/workspace">
            <span className="resolve-btn-shine inline-flex rounded-resolve-lg resolve-accent-gradient px-5 py-2.5 text-xs font-semibold text-white shadow-resolve-accent transition hover:shadow-resolve-glow hover:scale-[1.02]">
              Open workspace
            </span>
          </Link>
          <AuthHeader />
        </div>
      </div>
    </header>
  );
}
