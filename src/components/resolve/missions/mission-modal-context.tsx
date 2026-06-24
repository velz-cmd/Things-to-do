"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ReactNode,
} from "react";

type MissionModalContextValue = {
  open: boolean;
  openModal: () => void;
  closeModal: () => void;
};

const MissionModalContext = createContext<MissionModalContextValue | null>(null);

export function MissionModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  const openModal = useCallback(() => setOpen(true), []);
  const closeModal = useCallback(() => setOpen(false), []);

  return (
    <MissionModalContext.Provider value={{ open, openModal, closeModal }}>
      {children}
    </MissionModalContext.Provider>
  );
}

export function useMissionModal() {
  const ctx = useContext(MissionModalContext);
  if (!ctx) {
    throw new Error("useMissionModal must be used within MissionModalProvider");
  }
  return ctx;
}
