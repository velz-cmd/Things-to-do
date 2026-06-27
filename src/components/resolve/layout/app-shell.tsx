"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { CommandProvider } from "@/components/resolve/command/command-context";
import { MissionScopeProvider } from "@/lib/mission/mission-context";
import { MissionModalProvider } from "@/components/resolve/missions/mission-modal-context";
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
  return (
    <CommandProvider>
      <MissionModalProvider>
        <Suspense fallback={null}>
          <MissionScopeProvider>
            <div className="relative min-h-screen text-white">
              <ResolveBackground variant="app" />
              <AppTopNav />
              <MissionScopeBarGate />
              <main className="relative overflow-auto">{children}</main>
            </div>
            <NewMissionModal />
          </MissionScopeProvider>
        </Suspense>
      </MissionModalProvider>
    </CommandProvider>
  );
}
