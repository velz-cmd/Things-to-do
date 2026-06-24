"use client";

import { CommandProvider } from "@/components/resolve/command/command-context";
import { MissionModalProvider } from "@/components/resolve/missions/mission-modal-context";
import { NewMissionModal } from "@/components/resolve/missions/new-mission-modal";
import { AppTopNav } from "@/components/resolve/layout/app-top-nav";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <CommandProvider>
      <MissionModalProvider>
        <div className="min-h-screen bg-resolve-bg text-white">
          <AppTopNav />
          <main className="overflow-auto">{children}</main>
        </div>
        <NewMissionModal />
      </MissionModalProvider>
    </CommandProvider>
  );
}
