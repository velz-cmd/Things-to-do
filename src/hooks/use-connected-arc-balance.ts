"use client";

import { useMemo } from "react";
import { formatUnits } from "viem";
import { useAccount, useBalance } from "wagmi";
import { arcTestnet } from "@/lib/arc/config";

export type ConnectedArcBalance = {
  address: `0x${string}` | undefined;
  usdc: number;
  loaded: boolean;
  isConnected: boolean;
  refetch: () => void;
};

/** Live Arc testnet USDC (native, 18 dec) for the wagmi-connected wallet. */
export function useConnectedArcBalance(): ConnectedArcBalance {
  const { address, isConnected } = useAccount();
  const { data, isLoading, refetch } = useBalance({
    address,
    chainId: arcTestnet.id,
    query: { enabled: Boolean(address && isConnected) },
  });

  const usdc = useMemo(() => {
    if (!data?.value) return 0;
    return Math.round(Number(formatUnits(data.value, 18)) * 100) / 100;
  }, [data?.value]);

  return {
    address: address as `0x${string}` | undefined,
    usdc,
    loaded: !isLoading || !isConnected,
    isConnected,
    refetch: () => {
      void refetch();
    },
  };
}
