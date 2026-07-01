"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { DiscoverGraphNode } from "@/lib/discover/radar";
import type { AutomationTrigger } from "@/lib/automation/types";

export type CommunityConsoleTab = "console" | "automate" | "advanced";

export type CommunityConsoleOpenRequest = {
  communitySlug: string;
  label?: string;
  node?: DiscoverGraphNode;
  tab?: CommunityConsoleTab;
  automationTrigger?: AutomationTrigger;
};

type CommunityConsoleContextValue = {
  request: CommunityConsoleOpenRequest | null;
  open: (options: CommunityConsoleOpenRequest) => void;
  clearRequest: () => void;
};

const CommunityConsoleContext = createContext<CommunityConsoleContextValue | null>(null);

export function DiscoverCommunityConsoleProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<CommunityConsoleOpenRequest | null>(null);

  const open = useCallback((options: CommunityConsoleOpenRequest) => {
    setRequest(options);
    document.getElementById("value-bubblemap")?.scrollIntoView({ behavior: "smooth" });
  }, []);

  const clearRequest = useCallback(() => setRequest(null), []);

  const value = useMemo(
    () => ({ request, open, clearRequest }),
    [request, open, clearRequest],
  );

  return (
    <CommunityConsoleContext.Provider value={value}>
      {children}
    </CommunityConsoleContext.Provider>
  );
}

export function useCommunityConsole() {
  const ctx = useContext(CommunityConsoleContext);
  if (!ctx) {
    throw new Error("useCommunityConsole must be used within DiscoverCommunityConsoleProvider");
  }
  return ctx;
}

export function useCommunityConsoleOptional() {
  return useContext(CommunityConsoleContext);
}
