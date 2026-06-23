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

const queryClient = new QueryClient();

if (projectId) {
  createAppKit({
    adapters: [wagmiAdapter],
    networks,
    projectId,
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
}

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
          {children}
          <Toaster
            theme="dark"
            position="bottom-right"
            toastOptions={{
              classNames: {
                toast: "bg-deputy-panel border-deputy-border text-white",
              },
            }}
          />
        </AuthProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
