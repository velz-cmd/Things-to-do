"use client";

import { Suspense } from "react";
import { createAppKit } from "@reown/appkit/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createAppQueryClient } from "@/lib/query/client";
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
import { UserConnectionsProvider } from "@/components/resolve/profile/user-connections-provider";
import { SensorBackgroundSync } from "@/components/resolve/connectors/sensor-background-sync";
import { ConnectionWarmup } from "@/components/resolve/profile/connection-warmup";
import { SignInProvider } from "@/components/auth/sign-in-context";
import { SignInModal } from "@/components/auth/sign-in-modal";
import { AuthErrorEffect } from "@/components/auth/auth-error-effect";
import { GmailAfterAuthEffect } from "@/components/auth/gmail-after-auth-effect";
import { WalletLinkEffect } from "@/components/wallet/wallet-link-effect";
import { ConnectedWalletSync } from "@/components/wallet/connected-wallet-sync";
import { JellyfinBackgroundSync } from "@/components/resolve/connectors/jellyfin-background-sync";
import { AddFundsProvider } from "@/components/wallet/add-funds-context";
import { SendFundsProvider } from "@/components/wallet/send-funds-context";

const queryClient = createAppQueryClient();

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
          <UserConnectionsProvider>
          <SignInProvider>
            <AddFundsProvider>
              <SendFundsProvider>
              <ConnectionWarmup />
              <WalletLinkEffect />
              <ConnectedWalletSync />
              <JellyfinBackgroundSync />
              <SensorBackgroundSync />
              <GmailAfterAuthEffect />
              <Suspense fallback={null}>
                <AuthErrorEffect />
              </Suspense>
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
              </SendFundsProvider>
            </AddFundsProvider>
          </SignInProvider>
          </UserConnectionsProvider>
        </AuthProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
