"use client";

import { createAppKit } from "@reown/appkit/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type State } from "wagmi";
import { Toaster } from "sonner";
import {
  appKitMetadata,
  networks,
  projectId,
  wagmiAdapter,
  wagmiConfig,
} from "@/lib/reown/config";
import { AuthProvider } from "@/components/auth/auth-provider";
import { SignInProvider } from "@/components/auth/sign-in-context";
import { SignInModal } from "@/components/auth/sign-in-modal";
import { GmailAfterAuthEffect } from "@/components/auth/gmail-after-auth-effect";
import { WalletLinkEffect } from "@/components/wallet/wallet-link-effect";
import { AddFundsProvider } from "@/components/wallet/add-funds-context";

const queryClient = new QueryClient();

createAppKit({
  adapters: [wagmiAdapter],
  networks,
  projectId: projectId || "00000000000000000000000000000000",
  metadata: appKitMetadata,
  themeMode: "dark",
  features: {
    analytics: false,
    email: false,
    socials: false,
  },
  enableWalletConnect: true,
  enableInjected: true,
  enableCoinbase: true,
  enableEIP6963: true,
});

export function Providers({
  children,
  initialState,
}: {
  children: React.ReactNode;
  initialState?: State;
}) {
  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <SignInProvider>
            <AddFundsProvider>
              <WalletLinkEffect />
              <GmailAfterAuthEffect />
              {children}
              <SignInModal />
              <Toaster
                theme="dark"
                position="bottom-right"
                toastOptions={{
                  classNames: {
                    toast: "bg-deputy-panel border-deputy-border text-white",
                  },
                }}
              />
            </AddFundsProvider>
          </SignInProvider>
        </AuthProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
