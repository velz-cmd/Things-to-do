"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CommandProvider } from "@/components/resolve/command/command-context";
import { AppShell } from "@/components/resolve/layout/app-shell";
import { AuthHeader } from "@/components/auth/auth-header";

function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-resolve-bg text-white">
      <header className="border-b border-resolve-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/">
            <p className="text-sm font-semibold">RESOLVE</p>
            <p className="text-[10px] text-resolve-muted-dim">Weight impact, settle on Arc</p>
          </Link>
          <div className="flex items-center gap-4">
            <nav className="hidden items-center gap-3 sm:flex">
              <Link href="/" className="text-xs font-medium text-white">
                Home
              </Link>
              <Link href="/discover" className="text-xs font-medium text-resolve-muted hover:text-white">
                Discover
              </Link>
              <Link href="/weight" className="text-xs font-medium text-resolve-muted hover:text-white">
                Weight
              </Link>
              <Link href="/methodology" className="text-xs font-medium text-resolve-muted hover:text-white">
                Methodology
              </Link>
              <Link href="/radar" className="text-xs font-medium text-resolve-muted hover:text-white">
                Radar
              </Link>
              <Link href="/stack" className="text-xs font-medium text-resolve-muted hover:text-white">
                Stack
              </Link>
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
