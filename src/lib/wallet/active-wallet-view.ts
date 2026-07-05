export type WalletView = "app" | "external";

const STORAGE_KEY = "resolve.wallet.view";
export const WALLET_VIEW_CHANGED_EVENT = "resolve.wallet.view.changed";

export function readWalletView(): WalletView {
  if (typeof window === "undefined") return "app";
  const v = localStorage.getItem(STORAGE_KEY);
  return v === "external" ? "external" : "app";
}

export function writeWalletView(view: WalletView) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, view);
  window.dispatchEvent(new CustomEvent(WALLET_VIEW_CHANGED_EVENT, { detail: view }));
}

export function walletViewLabel(view: WalletView): string {
  return view === "app" ? "RESOLVE wallet (Gmail)" : "Your connected wallet";
}
