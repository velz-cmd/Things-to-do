"use client";

import { usePathname } from "next/navigation";
import { AuthHeader } from "@/components/auth/auth-header";

const TITLES: Record<string, string> = {
  "/missions": "Missions",
  "/treasury": "Treasury",
  "/distribute": "Distribute",
  "/contributors": "Registry",
};

export function AppHeader() {
  const pathname = usePathname();
  const base = "/" + (pathname.split("/")[1] ?? "");
  const title = TITLES[base] ?? "RESOLVE";

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-resolve-border bg-resolve-bg px-6">
      <p className="text-sm font-medium text-white">{title}</p>
      <AuthHeader />
    </header>
  );
}
