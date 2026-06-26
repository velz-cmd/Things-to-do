"use client";

import { CommandProvider } from "@/components/resolve/command/command-context";
import { MissionModalProvider } from "@/components/resolve/missions/mission-modal-context";
import { NewMissionModal } from "@/components/resolve/missions/new-mission-modal";
import { AppTopNav } from "@/components/resolve/layout/app-top-nav";
import { ResolveBackground } from "@/components/resolve/layout/resolve-background";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <CommandProvider>
      <MissionModalProvider>
        <div className="relative min-h-screen text-white">
          <ResolveBackground variant="app" />
          <AppTopNav />
          <main className="relative overflow-auto">{children}</main>
        </div>
        <NewMissionModal />
      </MissionModalProvider>
    </CommandProvider>
  );
}
