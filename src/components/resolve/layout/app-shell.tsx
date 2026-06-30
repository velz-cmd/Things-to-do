"use client";

import clsx from "clsx";
import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { CommandProvider } from "@/components/resolve/command/command-context";
import { MissionScopeProvider } from "@/lib/mission/mission-context";
import { MissionModalProvider } from "@/components/resolve/missions/mission-modal-context";
import { CommandPaletteHost } from "@/components/resolve/command/command-palette-host";
import { NewMissionModal } from "@/components/resolve/missions/new-mission-modal";
import { AppTopNav } from "@/components/resolve/layout/app-top-nav";
import { MissionScopeBar } from "@/components/resolve/mission-control/mission-scope-bar";
import { ResolveBackground } from "@/components/resolve/layout/resolve-background";

function MissionScopeBarGate() {
  const pathname = usePathname();
  if (pathname === "/mission" || pathname.startsWith("/mission/")) return null;
  return <MissionScopeBar />;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isDiscover = pathname === "/discover" || pathname.startsWith("/discover/");

  return (
    <CommandProvider>
      <MissionModalProvider>
        <Suspense fallback={null}>
          <MissionScopeProvider>
            <div className={clsx("relative min-h-screen", isDiscover ? "text-slate-800" : "text-white")}>
              {!isDiscover && <ResolveBackground variant="app" />}
              <AppTopNav />
              <MissionScopeBarGate />
              <main className={clsx("relative overflow-auto", isDiscover && "discover-canvas")}>
                {children}
              </main>
            </div>
            <NewMissionModal />
            <CommandPaletteHost />
          </MissionScopeProvider>
        </Suspense>
      </MissionModalProvider>
    </CommandProvider>
  );
}
