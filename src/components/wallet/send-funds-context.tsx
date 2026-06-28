"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { SendFundsModal } from "@/components/wallet/send-funds-modal";

interface SendFundsContextValue {
  openSendFunds: (suggestedUsd?: number) => void;
  closeSendFunds: () => void;
}

const SendFundsContext = createContext<SendFundsContextValue | null>(null);

export function SendFundsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [suggestedUsd, setSuggestedUsd] = useState<number | undefined>();

  const openSendFunds = useCallback((amount?: number) => {
    setSuggestedUsd(amount);
    setOpen(true);
  }, []);

  const closeSendFunds = useCallback(() => {
    setOpen(false);
    setSuggestedUsd(undefined);
  }, []);

  const value = useMemo(
    () => ({ openSendFunds, closeSendFunds }),
    [openSendFunds, closeSendFunds],
  );

  return (
    <SendFundsContext.Provider value={value}>
      {children}
      <SendFundsModal
        open={open}
        suggestedUsd={suggestedUsd}
        onClose={closeSendFunds}
      />
    </SendFundsContext.Provider>
  );
}

export function useSendFunds() {
  const ctx = useContext(SendFundsContext);
  if (!ctx) throw new Error("useSendFunds must be used within SendFundsProvider");
  return ctx;
}
