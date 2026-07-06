"use client";

import { useEffect } from "react";
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
  const isMission = pathname === "/mission" || pathname.startsWith("/mission/");

  useEffect(() => {
    document.documentElement.classList.toggle("discover-route", isDiscover);
    document.body.classList.toggle("discover-route", isDiscover);
    document.documentElement.classList.toggle("mission-route", isMission);
    document.body.classList.toggle("mission-route", isMission);
    return () => {
      document.documentElement.classList.remove("discover-route", "mission-route");
      document.body.classList.remove("discover-route", "mission-route");
    };
  }, [isDiscover, isMission]);

  return (
    <CommandProvider>
      <MissionModalProvider>
        <Suspense fallback={null}>
          <MissionScopeProvider>
            <div
              className={clsx(
                "relative min-h-screen text-white",
                isDiscover && "discover-canvas",
                isMission && "mission-canvas",
              )}
            >
              <ResolveBackground variant={isDiscover || isMission ? "hero" : "app"} />
              <AppTopNav />
              <MissionScopeBarGate />
              <main className="relative flex-1 overflow-auto">{children}</main>
            </div>
            <NewMissionModal />
            <CommandPaletteHost />
          </MissionScopeProvider>
        </Suspense>
      </MissionModalProvider>
    </CommandProvider>
  );
}
