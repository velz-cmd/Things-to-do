/** Plain-language receipt copy — readable for crypto and non-crypto users. */

export type ReceiptKind = "earning" | "payout";

export const RECEIPT_COPY = {
  pageEyebrow: "Verified receipt",
  share: "Share link",
  shareCopied: "Link copied",
  openPayments: "Your account",
  viewCommunity: "View community",
  copyUrl: "Copy link",
  footer: "RESOLVE verified receipt",

  earning: {
    kind: "earning" as const,
    badge: "Earning",
    title: "Earning receipt",
    subtitle:
      "One verified contribution — who earned it, from which community, and how much.",
    amountLabel: "Amount earned",
    recipientSection: "Paid to",
  },
  payout: {
    kind: "payout" as const,
    badge: "Payout",
    title: "Payout receipt",
    subtitle:
      "A batch release to everyone who earned from this program — transparent and shareable.",
    amountLabel: "Total paid out",
    recipientSection: "Recipients",
    itemsLabel: (n: number) => `${n} earning${n === 1 ? "" : "s"} included`,
  },

  fields: {
    mission: "Program",
    community: "Community",
    source: "Where it came from",
    activity: "What happened",
    context: "Details",
    proof: "Verification ID",
    recorded: "Recorded",
    paid: "Paid on",
  },

  paymentProof: {
    title: "Payment proof",
    onChain: "Verified on the payment network",
    viewExplorer: "View transaction",
    pending:
      "Recorded in RESOLVE. A public transaction link appears after the payout is sent.",
    optionalNote: "Advanced — on-chain confirmation (optional to view)",
  },
} as const;

export function receiptKindCopy(kind: ReceiptKind) {
  return kind === "earning" ? RECEIPT_COPY.earning : RECEIPT_COPY.payout;
}

export function friendlyReceiptStatus(status: string): string {
  const map: Record<string, string> = {
    authorized: "Recognized",
    pending_funding: "Waiting for program funds",
    claimable: "Ready to collect",
    claimed: "Collected",
    settled: "Paid",
    cancelled: "Cancelled",
    CREATED: "Processing",
    SETTLED: "Paid",
    PROCESSING: "Processing",
    READY: "Ready",
    ESCROW_LOCKED: "Funds reserved",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

export function friendlyEventType(eventType: string): string {
  const map: Record<string, string> = {
    scrobble_play: "Music play",
    music_play: "Music play",
    navidrome_play: "Music play",
    video_watch: "Video watched",
    docs_merged: "Documentation merged",
    code_contribution: "Code contribution",
    github_contribution: "GitHub contribution",
    citation_verified: "Citation verified",
    research_citation: "Research citation",
  };
  return map[eventType] ?? eventType.replace(/_/g, " ");
}

export function friendlyPayeeRole(payeeKeyType: string): string {
  if (payeeKeyType === "github_username") return "Contributor";
  if (payeeKeyType.startsWith("listen_")) return "Artist or credit";
  if (payeeKeyType === "musicbrainz_artist") return "Artist";
  if (payeeKeyType === "wallet") return "Account";
  return "Recipient";
}

export const ARTIST_PAYOUT_COPY = {
  title: "Get paid as an artist",
  subtitle:
    "When your music is played in a RESOLVE community, we match credits to your name and send earnings to your account.",
  howItWorksTitle: "How it works",
  steps: [
    {
      title: "Search your artist name",
      body: "We use MusicBrainz — the public database behind album credits — to find the right name.",
    },
    {
      title: "Confirm it's you",
      body: "Pick your name from the list. If there are two artists with the same name, use the subtitle to tell them apart.",
    },
    {
      title: "Choose where earnings go",
      body: "Earnings land in your RESOLVE account. Sign in with email if you prefer — no crypto experience required.",
    },
  ],
  searchPlaceholder: "Type your artist name…",
  searching: "Searching artist credits…",
  noResults: "No match — try a different spelling or add your stage name.",
  needAccount: {
    title: "Add a payout account first",
    body: "Sign in and connect a wallet in Settings, or use email sign-in — we create a simple account for you.",
    cta: "Open settings",
  },
  confirmButton: "This is me",
  confirmedButton: "Confirmed",
  linkedTitle: "You're set up",
  linkedBody: "Plays and credits for this name can route earnings to your account.",
  linkedToast: "Artist name confirmed — earnings will route to your account",
  errorSearch: "Could not search right now — try again in a moment",
  errorLink: "Could not save — try again",
} as const;
