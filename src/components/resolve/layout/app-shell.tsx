"use client";

import { CommandProvider } from "@/components/resolve/command/command-context";
import { MissionModalProvider } from "@/components/resolve/missions/mission-modal-context";
import { NewMissionModal } from "@/components/resolve/missions/new-mission-modal";
import { AppSidebar } from "@/components/resolve/layout/app-sidebar";
import { AppHeader } from "@/components/resolve/layout/app-header";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <CommandProvider>
      <MissionModalProvider>
        <div className="flex min-h-screen bg-resolve-bg text-white">
          <AppSidebar />
          <div className="flex min-w-0 flex-1 flex-col">
            <AppHeader />
            <main className="flex-1 overflow-auto">{children}</main>
          </div>
        </div>
        <NewMissionModal />
      </MissionModalProvider>
    </CommandProvider>
  );
}
