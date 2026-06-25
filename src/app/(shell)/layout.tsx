"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { CommandProvider } from "@/components/resolve/command/command-context";
import { AppShell } from "@/components/resolve/layout/app-shell";
import { AuthHeader } from "@/components/auth/auth-header";
import { PRODUCT_NAV } from "@/components/resolve/layout/nav";

function MarketingShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-resolve-bg text-white">
      <header className="border-b border-resolve-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/">
            <p className="text-sm font-semibold">RESOLVE</p>
          </Link>
          <div className="flex items-center gap-4">
            <nav className="hidden items-center gap-1 sm:flex">
              {PRODUCT_NAV.map((item) => {
                const active = item.exact
                  ? pathname === item.href
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={clsx(
                      "rounded-md px-2.5 py-1.5 text-xs font-medium transition",
                      active ? "text-white" : "text-resolve-muted hover:text-white",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
            <AuthHeader />
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isMarketing = pathname === "/";

  if (isMarketing) {
    return <CommandProvider><MarketingShell>{children}</MarketingShell></CommandProvider>;
  }

  return <AppShell>{children}</AppShell>;
}
