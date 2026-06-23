"use client";

import { CommandProvider } from "@/components/resolve/command/command-context";
import { FloatingCommandBar } from "@/components/resolve/command/floating-command-bar";
import { ResolveTopNav } from "@/components/resolve/nav/top-nav";

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <CommandProvider>
      <div className="flex min-h-screen flex-col bg-resolve-bg text-white">
        <ResolveTopNav />
        <main className="flex-1">{children}</main>
        <FloatingCommandBar />
      </div>
    </CommandProvider>
  );
}
