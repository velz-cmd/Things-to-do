"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { AddFundsModal } from "@/components/wallet/add-funds-modal";

interface AddFundsContextValue {
  openAddFunds: (suggestedUsd?: number) => void;
  closeAddFunds: () => void;
}

const AddFundsContext = createContext<AddFundsContextValue | null>(null);

export function AddFundsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [suggestedUsd, setSuggestedUsd] = useState<number | undefined>();

  const openAddFunds = useCallback((amount?: number) => {
    setSuggestedUsd(amount);
    setOpen(true);
  }, []);

  const closeAddFunds = useCallback(() => {
    setOpen(false);
    setSuggestedUsd(undefined);
  }, []);

  const value = useMemo(
    () => ({ openAddFunds, closeAddFunds }),
    [openAddFunds, closeAddFunds]
  );

  return (
    <AddFundsContext.Provider value={value}>
      {children}
      <AddFundsModal
        open={open}
        suggestedUsd={suggestedUsd}
        onClose={closeAddFunds}
      />
    </AddFundsContext.Provider>
  );
}

export function useAddFunds() {
  const ctx = useContext(AddFundsContext);
  if (!ctx) throw new Error("useAddFunds must be used within AddFundsProvider");
  return ctx;
}
