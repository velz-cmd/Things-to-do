"use client";

import { CommandProvider } from "@/components/resolve/command/command-context";
import { CommandPaletteHost } from "@/components/resolve/command/command-palette-host";
import { MarketingTopNav } from "@/components/resolve/layout/app-top-nav";
import { AppShell } from "@/components/resolve/layout/app-shell";
import { ResolveBackground } from "@/components/resolve/layout/resolve-background";
import { usePathname } from "next/navigation";

function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen text-white">
      <ResolveBackground variant="hero" />
      <MarketingTopNav />
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
    return (
      <CommandProvider>
        <MarketingShell>{children}</MarketingShell>
        <CommandPaletteHost />
      </CommandProvider>
    );
  }

  return <AppShell>{children}</AppShell>;
}
