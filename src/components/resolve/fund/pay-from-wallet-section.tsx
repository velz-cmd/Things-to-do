"use client";

import type { FundingWalletChoice } from "@/hooks/use-funding-wallet-choice";
import { WalletSourcePicker } from "@/components/resolve/fund/wallet-source-picker";

type PayFromWalletSectionProps = {
  amountUsd: number;
  disabled?: boolean;
  choice: FundingWalletChoice;
  className?: string;
};

/** “Pay from” picker — RESOLVE Circle wallet vs connected Arc wallet. */
export function PayFromWalletSection({
  amountUsd,
  disabled,
  choice,
  className,
}: PayFromWalletSectionProps) {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return null;

  return (
    <div className={className}>
      <WalletSourcePicker
        appUsd={choice.spendable.appSpendableUsd}
        extUsd={choice.spendable.externalSpendableUsd}
        amountUsd={amountUsd}
        externalReady={choice.externalWalletReady}
        hasLinkedExternal={choice.hasLinkedExternal}
        value={choice.chosenWallet ?? choice.fundingSource}
        onChange={choice.setChosenWallet}
        disabled={disabled}
        onReconnectExternal={choice.openConnectWallet}
      />
    </div>
  );
}
