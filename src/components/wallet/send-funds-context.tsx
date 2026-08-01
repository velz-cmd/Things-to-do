"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { SendFundsModal } from "@/components/wallet/send-funds-modal";

export type SendFundsRequest = {
  suggestedUsd?: number;
  recipientUserId?: string;
  recipientLabel?: string;
};

interface SendFundsContextValue {
  openSendFunds: (request?: number | SendFundsRequest) => void;
  closeSendFunds: () => void;
}

const SendFundsContext = createContext<SendFundsContextValue | null>(null);

export function SendFundsProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [request, setRequest] = useState<SendFundsRequest>({});

  const openSendFunds = useCallback((next?: number | SendFundsRequest) => {
    setRequest(typeof next === "number" ? { suggestedUsd: next } : (next ?? {}));
    setOpen(true);
  }, []);

  const closeSendFunds = useCallback(() => {
    setOpen(false);
    setRequest({});
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
        suggestedUsd={request.suggestedUsd}
        recipientUserId={request.recipientUserId}
        recipientLabel={request.recipientLabel}
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
