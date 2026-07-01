import type { UserWorkStream } from "@/lib/earn/user-eligible-work";

export type DiscoverEarnConnector = {
  id: "github" | "listenbrainz" | "jellyfin" | "musicbrainz";
  label: string;
  connected: boolean;
  displayValue?: string;
  authorizeUrl: string;
  hint?: string;
};

export type DiscoverEarnResponse = {
  ok: boolean;
  signedIn: boolean;
  earnings?: import("@/lib/earn/summary").ProfileEarningsSummary;
  connectors?: DiscoverEarnConnector[];
  recentReceipts?: import("@/lib/earn/recent-receipts").EarnReceiptSnippet[];
  claimUrl?: string | null;
  eligibility: import("@/lib/earn/eligibility-copy").EarnEligibilityRule[];
  workStreams?: UserWorkStream[];
  identityCount?: number;
  degraded?: boolean;
};
