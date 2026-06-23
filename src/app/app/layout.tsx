import Link from "next/link";
import { WalletConnect } from "@/components/wallet-connect";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-deputy-bg text-white">
      <header className="border-b border-deputy-border bg-deputy-panel/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              DEPUTY
            </Link>
            <span className="hidden text-xs text-deputy-muted sm:inline">
              Operations console
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/merchant"
              className="text-xs text-deputy-muted underline hover:text-deputy-accent"
            >
              Merchant portal
            </Link>
            <WalletConnect />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-4 p-4 lg:grid-cols-12">
        {children}
      </div>
    </div>
  );
}
