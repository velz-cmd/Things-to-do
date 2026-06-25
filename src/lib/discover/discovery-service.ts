import { gmailSearchReceipts } from "@/lib/deputy/tools/gmail";
import { isDeputyDemoMode } from "@/lib/config/demo-mode";
import { googleOAuthConfigured } from "@/lib/google/oauth";
import { isGmailConnectedForUser } from "@/lib/google/gmail-token";
import { getArcUsdcBalance, getArcTransactionCount, isAlchemyConfigured } from "@/lib/wallet/alchemy";
import { isWalletLabelsConfigured, lookupWalletLabel } from "@/lib/wallet/wallet-labels";

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
    label: "StreamDemo (hackathon merchant)",
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
    label: "SkyDemo Airlines delay (hackathon merchant)",
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

function demoHackathonItems(items: DiscoveryItem[]): DiscoveryItem[] {
  if (!isDeputyDemoMode()) return [];
  return items;
}

export async function discoverSubscriptions(userId?: string | null): Promise<{
  items: DiscoveryItem[];
  source: "gmail" | "demo" | "none";
  message?: string;
  gmailConfigured: boolean;
  gmailConnected: boolean;
}> {
  const gmailConfigured = googleOAuthConfigured();
  const gmailConnected = await isGmailConnectedForUser(userId);

  if (!gmailConfigured) {
    return {
      items: demoHackathonItems(DEMO_SUBSCRIPTIONS),
      source: isDeputyDemoMode() ? "demo" : "none",
      message: isDeputyDemoMode()
        ? "Demo subscriptions — add GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET on Vercel for live Gmail"
        : "Gmail OAuth not configured on server — connect when GOOGLE_CLIENT_ID is set",
      gmailConfigured: false,
      gmailConnected: false,
    };
  }

  if (!gmailConnected) {
    return {
      items: demoHackathonItems(DEMO_SUBSCRIPTIONS),
      source: isDeputyDemoMode() ? "demo" : "none",
      message: isDeputyDemoMode()
        ? "Demo data — connect Gmail for live subscription discovery"
        : "Connect Gmail to discover subscriptions",
      gmailConfigured: true,
      gmailConnected: false,
    };
  }

  const receipt = await gmailSearchReceipts("subscription renewal billing", userId);
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
        ...demoHackathonItems(DEMO_SUBSCRIPTIONS),
      ],
      source: "gmail",
      gmailConfigured: true,
      gmailConnected: true,
    };
  }

  return {
    items: demoHackathonItems(DEMO_SUBSCRIPTIONS),
    source: isDeputyDemoMode() ? "demo" : "none",
    message: receipt.error ?? "No subscriptions found in Gmail — try again or enter manually",
    gmailConfigured: true,
    gmailConnected: true,
  };
}

export async function discoverRefunds(userId?: string | null): Promise<{
  items: DiscoveryItem[];
  source: "gmail" | "demo" | "none";
  message?: string;
  gmailConfigured: boolean;
  gmailConnected: boolean;
}> {
  const gmailConfigured = googleOAuthConfigured();
  const gmailConnected = await isGmailConnectedForUser(userId);

  if (!gmailConfigured) {
    return {
      items: demoHackathonItems(DEMO_REFUNDS),
      source: isDeputyDemoMode() ? "demo" : "none",
      message: isDeputyDemoMode()
        ? "Demo refunds — SkyDemo/StreamDemo are hackathon merchant paths"
        : "Gmail OAuth not configured on server",
      gmailConfigured: false,
      gmailConnected: false,
    };
  }

  if (!gmailConnected) {
    return {
      items: demoHackathonItems(DEMO_REFUNDS),
      source: isDeputyDemoMode() ? "demo" : "none",
      message: isDeputyDemoMode()
        ? "Demo data — connect Gmail for live refund discovery"
        : "Connect Gmail to find refund opportunities",
      gmailConfigured: true,
      gmailConnected: false,
    };
  }

  const receipt = await gmailSearchReceipts("flight delayed refund", userId);
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
        ...demoHackathonItems(DEMO_REFUNDS),
      ],
      source: "gmail",
      gmailConfigured: true,
      gmailConnected: true,
    };
  }

  return {
    items: demoHackathonItems(DEMO_REFUNDS),
    source: isDeputyDemoMode() ? "demo" : "none",
    message: receipt.error ?? "No refund receipts found — enter booking reference manually",
    gmailConfigured: true,
    gmailConnected: true,
  };
}

export async function discoverParcels(userId?: string | null): Promise<{
  items: DiscoveryItem[];
  source: "gmail" | "demo" | "none";
  message?: string;
}> {
  const gmailConnected = await isGmailConnectedForUser(userId);

  if (!gmailConnected) {
    return {
      items: demoHackathonItems(DEMO_PARCELS),
      source: isDeputyDemoMode() ? "demo" : "none",
      message: isDeputyDemoMode()
        ? "Demo parcels — connect Gmail or enter tracking on Mission"
        : "Connect Gmail or enter tracking number on Mission",
    };
  }

  return {
    items: demoHackathonItems(DEMO_PARCELS),
    source: isDeputyDemoMode() ? "demo" : "none",
    message: "Parcel discovery from Gmail shipping labels — enter tracking for live lookup",
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

  if (!isAlchemyConfigured() && !isWalletLabelsConfigured()) {
    return {
      items: [],
      source: "none",
      message: "Configure ALCHEMY_API_KEY or WALLET_LABELS_API_KEY for live wallet scan",
    };
  }

  const items: DiscoveryItem[] = [];
  const short = `${address.slice(0, 6)}…${address.slice(-4)}`;

  try {
    if (isAlchemyConfigured()) {
      const { balanceUsd } = await getArcUsdcBalance(address);
      const txCount = await getArcTransactionCount(address);
      items.push({
        id: "wallet-usdc-balance",
        label:
          balanceUsd > 0.01
            ? `${short} — ${balanceUsd.toFixed(2)} USDC on Arc`
            : `${short} — low Arc USDC (${txCount} txs)`,
        company: "Arc",
        amountUsd: balanceUsd,
        period: balanceUsd > 0.01 ? "balance" : "idle",
        isDemo: false,
        source: "alchemy",
      });
    }
  } catch (e) {
    console.warn("Alchemy wallet scan failed:", e);
  }

  try {
    if (isWalletLabelsConfigured()) {
      const label = await lookupWalletLabel(address);
      if (label?.name) {
        items.push({
          id: "wallet-label",
          label: `${label.name}${label.category ? ` (${label.category})` : ""}`,
          company: label.category ?? "Wallet",
          amountUsd: 0,
          period: label.risk?.toLowerCase() ?? "labeled",
          isDemo: false,
          source: "walletlabels",
        });
      }
    } else {
      items.push({
        id: "wallet-labels-missing",
        label: `${short} — WalletLabels not configured`,
        company: "WalletLabels",
        amountUsd: 0,
        period: "needs_api_key",
        isDemo: false,
        source: "config",
      });
    }
  } catch (e) {
    console.warn("WalletLabels lookup failed:", e);
  }

  if (items.length === 0) {
    return {
      items: [],
      source: "scan",
      message: "No labeled assets found — wallet may be new or unlabeled",
    };
  }

  return {
    items,
    source: "scan",
    message: isWalletLabelsConfigured()
      ? "Live scan via Alchemy + WalletLabels"
      : "Live Arc balance via Alchemy — add WALLET_LABELS_API_KEY for entity labels",
  };
}
