"use client";

import { useEffect, useRef } from "react";
import { useAppKit } from "@reown/appkit/react";
import { useAccount } from "wagmi";
import { useSignInModal } from "@/components/auth/sign-in-context";

/** Close AppKit + sign-in modal when wallet connects; surface connect timeout. */
export function WalletAuthEffect({
  walletConnecting,
  onWalletConnectingChange,
  onWalletTimeout,
}: {
  walletConnecting: boolean;
  onWalletConnectingChange: (v: boolean) => void;
  onWalletTimeout?: () => void;
}) {
  const { address, isConnected } = useAccount();
  const { close } = useAppKit();
  const { closeSignIn } = useSignInModal();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!walletConnecting) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    timeoutRef.current = setTimeout(() => {
      onWalletConnectingChange(false);
      onWalletTimeout?.();
    }, 30_000);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [walletConnecting, onWalletConnectingChange, onWalletTimeout]);

  useEffect(() => {
    if (!isConnected || !address) return;

    onWalletConnectingChange(false);
    void close();
    closeSignIn();
  }, [isConnected, address, close, closeSignIn, onWalletConnectingChange]);

  return null;
}
