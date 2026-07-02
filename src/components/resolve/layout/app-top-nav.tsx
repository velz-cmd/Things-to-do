"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Command } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AuthHeader } from "@/components/auth/auth-header";
import { PRODUCT_NAV } from "@/components/resolve/layout/nav";
import { prefetchDiscoverTab, prefetchProfileTab, prefetchCommunitiesTab } from "@/lib/query/hooks";

export function ResolveLogo({ className }: { className?: string }) {
  return (
    <Link href="/" className={clsx("group flex items-center gap-2.5", className)}>
      <span className="relative flex h-8 w-8 items-center justify-center rounded-xl resolve-accent-gradient shadow-resolve-glow transition group-hover:scale-105">
        <span className="text-xs font-bold text-white">R</span>
      </span>
      <span className="text-sm font-semibold tracking-[0.08em] text-white">RESOLVE</span>
    </Link>
  );
}

function isActive(pathname: string, href: string) {
  if (href === "/mission") {
    return (
      pathname === href ||
      pathname.startsWith("/mission/") ||
      pathname.startsWith("/control") ||
      pathname.startsWith("/workspace")
    );
  }
  if (href === "/communities") {
    return pathname === href || pathname.startsWith("/communities/");
  }
  if (href === "/capital") {
    return (
      pathname === href ||
      pathname.startsWith("/capital") ||
      pathname.startsWith("/payments")
    );
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function ProductNav({ compact = false }: { compact?: boolean }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();

  function onNavPrefetch(href: string) {
    if (href === "/discover") prefetchDiscoverTab(queryClient);
    if (href === "/profile") prefetchProfileTab(queryClient);
    if (href === "/communities") prefetchCommunitiesTab(queryClient);
  }

  return (
    <nav
      className={clsx(
        "flex items-center gap-0.5 rounded-2xl resolve-glass-subtle p-1 shadow-resolve",
        compact && "hidden sm:flex",
      )}
    >
      {PRODUCT_NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch
            title={item.question}
            onPointerDown={() => onNavPrefetch(item.href)}
            onMouseEnter={() => onNavPrefetch(item.href)}
            onFocus={() => onNavPrefetch(item.href)}
            className={clsx(
              "relative flex items-center gap-2 rounded-xl px-3 py-2 text-[12px] font-medium transition-all duration-300",
              active
                ? "bg-resolve-accent/15 text-white ring-1 ring-resolve-accent/25"
                : "text-resolve-muted hover:bg-resolve-accent/10 hover:text-white",
            )}
          >
            <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
            {!compact && <span className="hidden md:inline">{item.label}</span>}
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
        <div className="flex items-center gap-4 lg:gap-6">
          <ResolveLogo />
          <ProductNav />
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("resolve:open-command-palette"))}
            className="hidden items-center gap-2 rounded-lg border border-white/[0.08] px-2.5 py-1.5 text-[11px] text-resolve-muted transition hover:border-resolve-accent/30 hover:text-white sm:flex"
            aria-label="Open command palette"
          >
            <Command className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Command</span>
            <kbd className="rounded border border-white/10 px-1 text-[10px]">⌘K</kbd>
          </button>
          <AuthHeader />
        </div>
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
          <Link href="/mission">
            <span className="resolve-btn-shine inline-flex rounded-resolve-lg resolve-accent-gradient px-5 py-2.5 text-xs font-semibold text-white shadow-resolve-accent">
              Open Mission
            </span>
          </Link>
          <AuthHeader />
        </div>
      </div>
    </header>
  );
}
