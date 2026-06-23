import { sepolia } from "viem/chains";
import { cookieStorage, createStorage } from "@wagmi/core";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";
import type { AppKitNetwork } from "@reown/appkit/networks";

export const sepoliaNetwork: AppKitNetwork = {
  id: sepolia.id,
  name: sepolia.name,
  nativeCurrency: sepolia.nativeCurrency,
  rpcUrls: sepolia.rpcUrls,
  blockExplorers: sepolia.blockExplorers,
  chainNamespace: "eip155",
  caipNetworkId: `eip155:${sepolia.id}`,
};

export const arcTestnetNetwork: AppKitNetwork = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "Arcscan", url: "https://testnet.arcscan.app" },
  },
  chainNamespace: "eip155",
  caipNetworkId: "eip155:5042002",
};

export const networks = [arcTestnetNetwork, sepoliaNetwork] as [
  AppKitNetwork,
  ...AppKitNetwork[],
];

export const projectId =
  process.env.NEXT_PUBLIC_REOWN_PROJECT_ID ??
  process.env.NEXT_PUBLIC_PROJECT_ID ??
  "";

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: cookieStorage }),
  ssr: true,
  projectId: projectId || "00000000000000000000000000000000",
  networks,
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;

export const appKitMetadata = {
  name: "RESOLVE",
  description: "Assign the problem. Pay only on proof.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "https://resolve-task.vercel.app",
  icons: ["https://resolve-task.vercel.app/favicon.ico"],
};
