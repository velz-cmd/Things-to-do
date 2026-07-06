"use client";

import { useEffect, useMemo, useState } from "react";
import { useSpendableUsd } from "@/hooks/use-spendable-usd";
import { useResolveAccess } from "@/hooks/use-resolve-access";
import {
  affordableFundingSources,
  pickFundingSource,
  type FundingSource,
} from "@/lib/wallet/funding-source";

/** Shared wallet picker state for any Arc payment (Discover, Capital, Mission). */
export function useFundingWalletChoice(amountUsd: number) {
  const spendable = useSpendableUsd();
  const { externalWalletReady, openConnectWallet } = useResolveAccess();
  const [chosenWallet, setChosenWallet] = useState<FundingSource | null>(null);

  const balances = useMemo(
    () => ({
      appSpendableUsd: spendable.appSpendableUsd,
      externalSpendableUsd: spendable.externalSpendableUsd,
    }),
    [spendable.appSpendableUsd, spendable.externalSpendableUsd],
  );

  const affordable = useMemo(
    () =>
      Number.isFinite(amountUsd) && amountUsd > 0
        ? affordableFundingSources(amountUsd, balances, externalWalletReady)
        : [],
    [amountUsd, balances, externalWalletReady],
  );

  const fundingSource = useMemo(() => {
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) return null;
    return pickFundingSource(amountUsd, balances, externalWalletReady, chosenWallet);
  }, [amountUsd, balances, externalWalletReady, chosenWallet]);

  useEffect(() => {
    if (affordable.length === 1) {
      setChosenWallet(affordable[0]);
    } else if (chosenWallet && affordable.includes(chosenWallet)) {
      return;
    } else if (affordable.includes("external")) {
      setChosenWallet("external");
    } else if (affordable.length > 0) {
      setChosenWallet(affordable[0]);
    }
  }, [affordable, chosenWallet]);

  const resolvedSource = chosenWallet ?? fundingSource;

  function assertFundingSource(): FundingSource {
    if (!resolvedSource) {
      throw new Error(
        spendable.spendableUsd <= 0
          ? "No spendable USDC — add funds in Capital or connect a wallet with Arc USDC"
          : `Pick a wallet with enough Arc USDC for $${amountUsd.toFixed(2)}`,
      );
    }
    if (!affordable.includes(resolvedSource)) {
      throw new Error(`Selected wallet cannot cover $${amountUsd.toFixed(2)}`);
    }
    return resolvedSource;
  }

  return {
    spendable,
    externalWalletReady,
    openConnectWallet,
    chosenWallet,
    setChosenWallet,
    fundingSource: resolvedSource,
    affordable,
    hasLinkedExternal: spendable.externalLinked,
    assertFundingSource,
  };
}

export type FundingWalletChoice = ReturnType<typeof useFundingWalletChoice>;
