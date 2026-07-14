"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  readWalletView,
  writeWalletView,
  WALLET_VIEW_CHANGED_EVENT,
  type WalletView,
} from "@/lib/wallet/active-wallet-view";
import { queryKeys } from "@/lib/query/keys";

export function useActiveWalletView() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<WalletView>("app");
  const [selectionPending, setSelectionPending] = useState(false);

  useEffect(() => {
    setView(readWalletView());
    function onChange() {
      setView(readWalletView());
    }
    window.addEventListener(WALLET_VIEW_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(WALLET_VIEW_CHANGED_EVENT, onChange);
  }, []);

  const setActiveWalletView = useCallback(async (next: WalletView) => {
    const previous = readWalletView();
    writeWalletView(next);
    setView(next);
    setSelectionPending(true);
    try {
      const response = await fetch("/api/capital/wallet-selection", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          wallet: next === "external" ? "connected" : "app",
          idempotencyKey:
            typeof crypto.randomUUID === "function"
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        }),
      });
      if (!response.ok) throw new Error("wallet_selection_rejected");
      await queryClient.invalidateQueries({ queryKey: queryKeys.capitalState, exact: true });
    } catch {
      writeWalletView(previous);
      setView(previous);
    } finally {
      setSelectionPending(false);
    }
  }, [queryClient]);

  return { view, setActiveWalletView, selectionPending };
}
