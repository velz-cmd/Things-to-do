import { gmailSearchReceipts } from "@/lib/deputy/tools/gmail";

export interface DiscoveryItem {
  id: string;
  label: string;
  company: string;
  amountUsd: number;
  period: string;
  isDemo: boolean;
  source: string;
}

const DEMO_SUBSCRIPTIONS: DiscoveryItem[] = [
  {
    id: "sub-adobe",
    label: "Adobe",
    company: "Adobe",
    amountUsd: 54.99,
    period: "mo",
    isDemo: true,
    source: "demo",
  },
  {
    id: "sub-canva",
    label: "Canva",
    company: "Canva",
    amountUsd: 14.99,
    period: "mo",
    isDemo: true,
    source: "demo",
  },
  {
    id: "sub-streamdemo",
    label: "StreamDemo",
    company: "StreamDemo",
    amountUsd: 12.99,
    period: "mo",
    isDemo: true,
    source: "demo",
  },
];

const DEMO_REFUNDS: DiscoveryItem[] = [
  {
    id: "ref-skydemo",
    label: "SkyDemo Airlines delay",
    company: "SkyDemo Airlines",
    amountUsd: 43,
    period: "estimated",
    isDemo: true,
    source: "demo",
  },
  {
    id: "ref-dhl",
    label: "DHL late parcel",
    company: "DHL",
    amountUsd: 18,
    period: "estimated",
    isDemo: true,
    source: "demo",
  },
];

const DEMO_PARCELS: DiscoveryItem[] = [
  {
    id: "parcel-dhl",
    label: "DHL tracking ending 9312",
    company: "DHL",
    amountUsd: 18,
    period: "delayed",
    isDemo: true,
    source: "demo",
  },
  {
    id: "parcel-fedex",
    label: "FedEx tracking ending 4821",
    company: "FedEx",
    amountUsd: 15,
    period: "exception",
    isDemo: true,
    source: "demo",
  },
];

function gmailConnected(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID &&
      process.env.GOOGLE_REFRESH_TOKEN &&
      process.env.GOOGLE_CLIENT_SECRET
  );
}

export async function discoverSubscriptions(): Promise<{
  items: DiscoveryItem[];
  source: "gmail" | "demo" | "none";
  message?: string;
}> {
  if (!gmailConnected()) {
    return {
      items: [],
      source: "none",
      message: "Connect Gmail to discover subscriptions and refund opportunities.",
    };
  }

  const receipt = await gmailSearchReceipts("subscription renewal billing");
  if (receipt.ok && receipt.data) {
    return {
      items: [
        {
          id: `sub-live-${receipt.data.merchant}`,
          label: receipt.data.merchant,
          company: receipt.data.merchant,
          amountUsd: receipt.data.amountUsd,
          period: "mo",
          isDemo: false,
          source: "gmail",
        },
        ...DEMO_SUBSCRIPTIONS.map((d) => ({ ...d, isDemo: true, source: "demo" })),
      ],
      source: "gmail",
    };
  }

  return {
    items: DEMO_SUBSCRIPTIONS,
    source: "demo",
    message: "Demo data — connect Gmail for live discovery",
  };
}

export async function discoverRefunds(): Promise<{
  items: DiscoveryItem[];
  source: "gmail" | "demo" | "none";
  message?: string;
}> {
  if (!gmailConnected()) {
    return {
      items: [],
      source: "none",
      message: "Connect Gmail to find refund opportunities.",
    };
  }

  const receipt = await gmailSearchReceipts("flight delayed refund");
  if (receipt.ok && receipt.data) {
    return {
      items: [
        {
          id: `ref-live-${receipt.data.bookingRef}`,
          label: `${receipt.data.merchant} — ${receipt.data.bookingRef}`,
          company: receipt.data.merchant,
          amountUsd: receipt.data.amountUsd,
          period: "estimated",
          isDemo: false,
          source: "gmail",
        },
        ...DEMO_REFUNDS,
      ],
      source: "gmail",
    };
  }

  return {
    items: DEMO_REFUNDS,
    source: "demo",
    message: "Demo data — connect Gmail for live discovery",
  };
}

export async function discoverParcels(): Promise<{
  items: DiscoveryItem[];
  source: "gmail" | "demo" | "none";
  message?: string;
}> {
  if (!gmailConnected()) {
    return {
      items: DEMO_PARCELS,
      source: "demo",
      message: "Demo data — connect Gmail or enter tracking number manually",
    };
  }

  return {
    items: DEMO_PARCELS,
    source: "demo",
    message: "Demo parcel candidates — enter tracking for live lookup",
  };
}

export async function discoverWallet(address: string): Promise<{
  items: DiscoveryItem[];
  source: "scan" | "none";
  message?: string;
}> {
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return {
      items: [],
      source: "none",
      message: "Enter a valid wallet address to scan assets and risks",
    };
  }

  return {
    items: [
      {
        id: "wallet-usdc",
        label: `Idle USDC on Arc scan: ${address.slice(0, 6)}…`,
        company: "Arc",
        amountUsd: 76,
        period: "idle",
        isDemo: true,
        source: "demo",
      },
    ],
    source: "scan",
    message: "Demo scan results — live Alchemy/GoPlus integration pending",
  };
}
