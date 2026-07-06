"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { MissionBlueprintPanelHandle } from "@/components/resolve/mission-control/mission-blueprint-panel";

type BlueprintCommandContextValue = {
  handle: MissionBlueprintPanelHandle | null;
  register: (handle: MissionBlueprintPanelHandle | null) => void;
};

const BlueprintCommandContext = createContext<BlueprintCommandContextValue | null>(null);

export function MissionBlueprintCommandProvider({ children }: { children: ReactNode }) {
  const [handle, setHandle] = useState<MissionBlueprintPanelHandle | null>(null);
  const register = useCallback((next: MissionBlueprintPanelHandle | null) => {
    setHandle(next);
  }, []);

  const value = useMemo(() => ({ handle, register }), [handle, register]);

  return (
    <BlueprintCommandContext.Provider value={value}>
      {children}
    </BlueprintCommandContext.Provider>
  );
}

export function useMissionBlueprintCommand() {
  return useContext(BlueprintCommandContext);
}
