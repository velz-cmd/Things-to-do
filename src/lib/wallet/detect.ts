export type DetectedWallet = {
  id: "metamask" | "rabby" | "coinbase" | "walletconnect";
  label: string;
};

type EthereumProvider = {
  isMetaMask?: boolean;
  isRabby?: boolean;
  isCoinbaseWallet?: boolean;
};

export function detectInjectedWallets(): DetectedWallet[] {
  if (typeof window === "undefined") return [];

  const eth = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  const wallets: DetectedWallet[] = [];

  if (eth?.isRabby) {
    wallets.push({ id: "rabby", label: "Rabby" });
  }
  if (eth?.isMetaMask && !eth?.isRabby) {
    wallets.push({ id: "metamask", label: "MetaMask" });
  }
  if (eth?.isCoinbaseWallet) {
    wallets.push({ id: "coinbase", label: "Coinbase Wallet" });
  }

  return wallets;
}

export function walletConnectorAvailable(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ??
      process.env.NEXT_PUBLIC_PROJECT_ID
  );
}
