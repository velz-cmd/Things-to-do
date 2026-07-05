"use client";

import { useCallback, useEffect, useState } from "react";
import {
  readWalletView,
  writeWalletView,
  WALLET_VIEW_CHANGED_EVENT,
  type WalletView,
} from "@/lib/wallet/active-wallet-view";

export function useActiveWalletView() {
  const [view, setView] = useState<WalletView>("app");

  useEffect(() => {
    setView(readWalletView());
    function onChange() {
      setView(readWalletView());
    }
    window.addEventListener(WALLET_VIEW_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(WALLET_VIEW_CHANGED_EVENT, onChange);
  }, []);

  const setActiveWalletView = useCallback((next: WalletView) => {
    writeWalletView(next);
    setView(next);
  }, []);

  return { view, setActiveWalletView };
}
