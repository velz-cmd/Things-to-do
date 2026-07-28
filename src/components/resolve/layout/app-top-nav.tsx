"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { CircleAlert, Command, LoaderCircle } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AuthHeader } from "@/components/auth/auth-header";
import { ResolveLogo } from "@/components/resolve/brand/resolve-logo";
import { PRODUCT_NAV } from "@/components/resolve/layout/nav";
import { prefetchDiscoverTab, prefetchProfileTab, prefetchCommunitiesTab } from "@/lib/query/hooks";

export function isProductRouteActive(pathname: string, href: string) {
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
  const router = useRouter();
  const queryClient = useQueryClient();
  const [hydrated, setHydrated] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const [failedHref, setFailedHref] = useState<string | null>(null);
  const pendingHrefRef = useRef<string | null>(null);

  useEffect(() => {
    setHydrated(true);
    PRODUCT_NAV.forEach((item) => router.prefetch(item.href));
  }, [router]);

  useEffect(() => {
    if (pendingHref && isProductRouteActive(pathname, pendingHref)) {
      pendingHrefRef.current = null;
      setPendingHref(null);
      setFailedHref(null);
      return;
    }
    if (failedHref && isProductRouteActive(pathname, failedHref)) {
      setFailedHref(null);
    }
  }, [pathname, pendingHref, failedHref]);

  useEffect(() => {
    if (!pendingHref) return;
    const timeout = window.setTimeout(() => {
      pendingHrefRef.current = null;
      setFailedHref(pendingHref);
      setPendingHref(null);
    }, 8_000);
    return () => window.clearTimeout(timeout);
  }, [pendingHref]);

  function onNavPrefetch(href: string) {
    router.prefetch(href);
    if (href === "/discover") prefetchDiscoverTab(queryClient);
    if (href === "/profile") prefetchProfileTab(queryClient);
    if (href === "/communities") prefetchCommunitiesTab(queryClient);
  }

  function onNavClick(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const currentPendingHref = pendingHrefRef.current;
    if (currentPendingHref === href || (!currentPendingHref && isProductRouteActive(pathname, href))) {
      event.preventDefault();
      return;
    }
    pendingHrefRef.current = href;
    setFailedHref(null);
    setPendingHref(href);
  }

  return (
    <nav
      aria-label="Primary navigation"
      aria-busy={pendingHref ? "true" : "false"}
      data-hydrated={hydrated ? "true" : "false"}
      className={clsx(
        "resolve-segmented flex max-w-[58vw] items-center gap-0.5 overflow-x-auto rounded-xl p-1",
        compact && "hidden sm:flex",
      )}
    >
      {PRODUCT_NAV.map((item) => {
        const active = isProductRouteActive(pathname, item.href);
        const pending = pendingHref === item.href;
        const failed = failedHref === item.href;
        const selected = pendingHref ? pending : active;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            prefetch={true}
            title={failed ? `Navigation to ${item.label} was delayed. Click to retry.` : item.question}
            aria-label={pending ? `${item.label}, loading` : item.label}
            aria-current={selected ? "page" : undefined}
            aria-busy={pending ? "true" : undefined}
            data-navigation-state={pending ? "pending" : failed ? "failed" : active ? "active" : "idle"}
            data-testid={`primary-tab-${item.label.toLowerCase()}`}
            onClick={(event) => onNavClick(event, item.href)}
            onPointerDown={() => onNavPrefetch(item.href)}
            onMouseEnter={() => onNavPrefetch(item.href)}
            onFocus={() => onNavPrefetch(item.href)}
            className={clsx(
              "relative flex min-h-9 shrink-0 items-center gap-2 rounded-[9px] px-3 py-2 text-[12px] font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resolve-accent",
              selected
                ? "bg-[#142640] text-white ring-1 ring-resolve-accent/35 shadow-[0_5px_16px_rgba(0,0,0,.22)]"
                : "text-resolve-muted hover:bg-white/[0.045] hover:text-white",
              failed && "text-amber-200 ring-1 ring-amber-300/30",
            )}
          >
            {pending ? (
              <LoaderCircle className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
            ) : failed ? (
              <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            )}
            {!compact && <span className="hidden md:inline">{item.label}</span>}
            {pending && <span className="sr-only">Loading</span>}
            {failed && <span className="sr-only">Navigation delayed. Click to retry.</span>}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppTopNav() {
  return (
    <header className="resolve-topnav sticky top-0 z-40 border-b border-resolve-border">
      <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
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
  const publicLinks = [
    { label: "Product", href: "#product" },
    { label: "How it works", href: "#how-it-works" },
    { label: "Use cases", href: "#use-cases" },
    { label: "Architecture", href: "#architecture" },
    { label: "Open source", href: "#open-source" },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.07] bg-[#050b16]/80 backdrop-blur-xl">
      <div className="mx-auto grid h-[70px] max-w-[1380px] grid-cols-[1fr_auto] items-center gap-5 px-5 sm:px-7 lg:grid-cols-[1fr_auto_1fr] lg:px-9">
        <ResolveLogo wordmark className="justify-self-start" />
        <nav className="hidden items-center gap-7 lg:flex" aria-label="Homepage sections">
          {publicLinks.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="min-h-11 inline-flex items-center text-[12px] font-medium text-resolve-muted transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-resolve-accent"
            >
              {item.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center justify-self-end gap-3 sm:gap-4">
          <Link href="/mission">
            <span className="resolve-btn-shine inline-flex min-h-11 items-center rounded-[10px] border border-white/10 bg-gradient-to-r from-[#315fd6] to-[#7655d9] px-4 py-2.5 text-xs font-semibold text-white shadow-[0_8px_24px_rgba(67,86,211,.2)] transition active:scale-[.985] sm:px-5">
              Open Mission
            </span>
          </Link>
          <AuthHeader />
        </div>
      </div>
    </header>
  );
}
