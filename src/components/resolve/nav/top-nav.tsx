"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Home,
  Play,
  Target,
  Radar,
  FileCheck,
  Vault,
  CircleDollarSign,
  ClipboardCheck,
} from "lucide-react";
import { AuthHeader } from "@/components/auth/auth-header";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/start", label: "Start", icon: Play },
  { href: "/missions", label: "Missions", icon: Target },
  { href: "/radar", label: "Radar", icon: Radar },
  { href: "/proof", label: "Proof", icon: FileCheck },
  { href: "/vault", label: "Vault", icon: Vault },
  { href: "/settle", label: "Settle", icon: CircleDollarSign },
  { href: "/review", label: "Review", icon: ClipboardCheck },
];

export function ResolveTopNav() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <header
      className={clsx(
        "sticky top-0 z-50 border-b border-white/[0.06] backdrop-blur-xl",
        isHome ? "bg-resolve-bg/80" : "bg-resolve-bg/90"
      )}
    >
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 lg:px-8">
        <Link href="/" className="shrink-0">
          <p className="text-lg font-semibold tracking-tight text-white">RESOLVE</p>
          <p className="text-[10px] text-resolve-muted">Assign it. Get proof it is done.</p>
        </Link>

        <nav className="hidden items-center gap-0.5 overflow-x-auto lg:flex">
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition",
                  active
                    ? "bg-resolve-primary/15 text-sky-300"
                    : "text-resolve-muted hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <AuthHeader />
      </div>

      <nav className="flex gap-1 overflow-x-auto border-t border-white/[0.04] px-4 py-2 lg:hidden">
        {NAV.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs",
                active ? "bg-resolve-primary/15 text-sky-300" : "text-resolve-muted"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
