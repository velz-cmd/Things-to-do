import { prisma } from "@/lib/db";
import type { ConnectorId, ConnectorStatus } from "./connector-types";
import { CATEGORY_CONNECTORS } from "./connector-types";

function hasEnv(...keys: string[]): boolean {
  return keys.every((k) => Boolean(process.env[k]));
}

export async function getConnectorStatuses(
  userId?: string | null,
  category?: string
): Promise<ConnectorStatus[]> {
  const now = new Date().toISOString();
  let user: {
    gmailConnected: boolean;
    walletAddress: string | null;
    scanWalletAddress: string | null;
  } | null = null;

  if (userId) {
    user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        gmailConnected: true,
        walletAddress: true,
        scanWalletAddress: true,
      },
    });
  }

  const gmailServerConnected = hasEnv(
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_REFRESH_TOKEN"
  );
  const gmailUserConnected = user?.gmailConnected ?? false;
  const gmailConnected = gmailServerConnected || gmailUserConnected;

  const arcConnected = hasEnv("CIRCLE_API_KEY") && hasEnv("ARC_AGENT_WALLET_ADDRESS");
  const browserReady =
    process.env.PLAYWRIGHT_ENABLED === "true" || process.env.DEPUTY_DEMO_MODE === "true";
  const resendReady = hasEnv("RESEND_API_KEY");
  const walletConnected = Boolean(user?.walletAddress || user?.scanWalletAddress);

  const connectors: ConnectorStatus[] = [
    {
      id: "gmail",
      label: "Gmail",
      state: gmailConnected ? "connected" : "needs_auth",
      requiredFor: ["airline_refund", "subscription_cancellation", "charge_dispute"],
      lastCheckedAt: now,
      hint: gmailConnected
        ? undefined
        : "Connect Gmail to find receipts and subscriptions",
    },
    {
      id: "arc",
      label: "Arc wallet",
      state: arcConnected ? "connected" : "missing",
      requiredFor: ["airline_refund", "subscription_cancellation", "parcel_claim"],
      lastCheckedAt: now,
      hint: arcConnected ? undefined : "Connect Arc wallet to lock escrow",
    },
    {
      id: "circle",
      label: "Circle",
      state: hasEnv("CIRCLE_API_KEY") ? "connected" : "missing",
      requiredFor: ["wallet_guardian"],
      lastCheckedAt: now,
    },
    {
      id: "browser",
      label: "Browser",
      state: browserReady ? "ready" : "missing",
      requiredFor: ["airline_refund", "subscription_cancellation", "parcel_claim"],
      lastCheckedAt: now,
      hint: browserReady ? undefined : "Browser executor not configured",
    },
    {
      id: "resend",
      label: "Email send",
      state: resendReady ? "ready" : "missing",
      requiredFor: [],
      lastCheckedAt: now,
    },
    {
      id: "finance",
      label: "Finance",
      state: "missing",
      requiredFor: [],
      lastCheckedAt: now,
      hint: "Connect finance data to detect subscriptions",
    },
    {
      id: "flight",
      label: "Flight API",
      state: "missing",
      requiredFor: ["airline_refund"],
      lastCheckedAt: now,
      hint: "Using manual evidence",
    },
    {
      id: "parcel",
      label: "Carrier API",
      state: "missing",
      requiredFor: ["parcel_claim"],
      lastCheckedAt: now,
      hint: "Using manual tracking",
    },
    {
      id: "wallet",
      label: "Wallet scan",
      state: walletConnected ? "connected" : "missing",
      requiredFor: ["wallet_guardian"],
      lastCheckedAt: now,
      hint: walletConnected ? undefined : "Enter wallet address to scan",
    },
  ];

  if (!category) return connectors;
  return connectors;
}

export function getMissingRequiredConnectors(
  connectors: ConnectorStatus[],
  category: string
): ConnectorStatus[] {
  const spec = CATEGORY_CONNECTORS[category] ?? CATEGORY_CONNECTORS.manual;
  return connectors.filter(
    (c) =>
      spec.required.includes(c.id) &&
      !["connected", "ready"].includes(c.state)
  );
}

export function nextActionLabel(
  missing: ConnectorStatus[],
  task?: { escrowLocked?: boolean; intakeJson?: string | null }
): string {
  if (missing.length > 0) {
    const first = missing[0];
    switch (first.id) {
      case "gmail":
        return "Connect Gmail";
      case "arc":
        return "Connect Arc wallet";
      case "wallet":
        return "Enter wallet address";
      default:
        return `Connect ${first.label}`;
    }
  }
  if (task && !task.escrowLocked) {
    return "Lock $1 Arc escrow";
  }
  return "Start mission";
}

export function connectorActionForId(id: ConnectorId): string {
  const map: Record<ConnectorId, string> = {
    gmail: "Connect Gmail",
    arc: "Connect Arc wallet",
    circle: "Connect Circle",
    browser: "Enable browser executor",
    resend: "Configure email send",
    finance: "Connect finance data",
    flight: "Add booking reference",
    parcel: "Enter tracking number",
    wallet: "Enter wallet address",
  };
  return map[id];
}
