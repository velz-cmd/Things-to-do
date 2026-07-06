/** Plain-language receipt copy — readable for crypto and non-crypto users. */

export type ReceiptKind = "earning" | "payout" | "contribution";

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
      "One verified contribution from an existing community — who earned it, where it came from, and how much.",
    amountLabel: "Amount earned",
    recipientSection: "Paid to",
  },
  payout: {
    kind: "payout" as const,
    badge: "Payout",
    title: "Payout receipt",
    subtitle:
      "A batch release to everyone who earned from an existing community program — transparent and shareable.",
    amountLabel: "Total paid out",
    recipientSection: "Recipients",
    itemsLabel: (n: number) => `${n} earning${n === 1 ? "" : "s"} included`,
  },
  contribution: {
    kind: "contribution" as const,
    badge: "Pool contribution",
    title: "Funding receipt",
    subtitle:
      "USDC you added to a community program pool on Arc — reserved until verified creators settle at the next checkpoint.",
    amountLabel: "Amount funded",
    recipientSection: "Program pool",
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

  platformFee: {
    title: "Platform fee",
    signalCost: "Signal cost (x402)",
    resolveFee: "RESOLVE platform fee",
    netToProvider: "Net to signal provider",
    settlementNote:
      "x402 pays the provider per invoke; platform bps apply when the program settles on Arc.",
  },
} as const;

export function receiptKindCopy(kind: ReceiptKind) {
  if (kind === "earning") return RECEIPT_COPY.earning;
  if (kind === "contribution") return RECEIPT_COPY.contribution;
  return RECEIPT_COPY.payout;
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
    "mcp.invocation": "Agent signal purchased",
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

export const CONTRIBUTOR_IDENTITY_COPY = {
  title: "Payout identity",
  subtitle: "Link the accounts where your work happens — we match verified activity to you when programs pay out.",
  doctrine: {
    title: "",
    body: "",
    bullets: [] as string[],
  },
  communities: {
    open_source: {
      id: "open_source",
      label: "Open source & code",
      platform: "GitHub",
      icon: "github",
      whenYouEarn:
        "Merged docs, contributions, and maintainer work in funded programs like React or Linux communities.",
      audienceNote: "Contributors use GitHub as usual — RESOLVE reads public activity.",
      connectedLabel: "Connected as",
      connectCta: "Connect GitHub",
      connectHint: "Links your @username for code and maintainer payouts.",
      connectUrl: "/connect/github",
    },
    music: {
      id: "music",
      label: "Music & artists",
      platform: "MusicBrainz",
      icon: "music",
      whenYouEarn:
        "Verified plays in funded music communities — credits from album metadata, not from listeners joining RESOLVE.",
      audienceNote:
        "Listeners keep their normal apps and servers. If plays are part of a funded program, we match credits to your artist name.",
      searchPlaceholder: "Type your artist name…",
      searching: "Searching artist credits…",
      noResults: "No match — try a different spelling or stage name.",
      confirmButton: "This is me",
      confirmedButton: "Confirmed",
      linkedBody: "Plays and credits for this name can route earnings to your account.",
      linkedToast: "Artist name confirmed — earnings will route to your account",
      errorSearch: "Could not search right now — try again in a moment",
      errorLink: "Could not save — try again",
      aliasTitle: "Scrobble under a different name?",
      aliasHint:
        "If ListenBrainz or Navidrome shows a stage name that is not your MusicBrainz credit, link it here so plays still route to you.",
      aliasPlaceholder: "Stage name as it appears in scrobbles…",
      aliasButton: "Link scrobble name",
      aliasLinkedToast: "Scrobble name linked — plays under this name route to your wallet",
      aliasError: "Could not link name — try again",
    },
    media: {
      id: "media",
      label: "Video & media",
      platform: "Jellyfin",
      icon: "jellyfin",
      whenYouEarn:
        "Watches in funded Jellyfin communities — viewers use their own servers; creators still get credited.",
      audienceNote:
        "Viewers don't need a RESOLVE account. Connect Jellyfin if you host or watch from your library.",
      connectedLabel: "Connected",
      connectCta: "Connect Jellyfin",
      connectHint: "Sign in once — RESOLVE syncs watches from your server.",
      connectUrl: "/connect/jellyfin",
    },
    research: {
      id: "research",
      label: "Research & citations",
      platform: "OpenAlex",
      icon: "research",
      whenYouEarn:
        "Verified citations in open-research programs — scholars get credit from public research graphs.",
      audienceNote: "Readers don't join RESOLVE — we verify citations upstream.",
      exploreCta: "Open Research community",
      exploreUrl: "/communities/open-research",
    },
  },
  needAccount: {
    title: "Add a payout account first",
    body: "Sign in and connect a wallet in Settings, or use email sign-in — we create a simple account for you. No crypto experience required.",
    cta: "Open settings",
  },
} as const;

/** @deprecated use CONTRIBUTOR_IDENTITY_COPY.communities.music */
export const ARTIST_PAYOUT_COPY = {
  title: CONTRIBUTOR_IDENTITY_COPY.communities.music.label,
  subtitle: CONTRIBUTOR_IDENTITY_COPY.communities.music.whenYouEarn,
  howItWorksTitle: "How it works",
  steps: [
    {
      title: "Search your artist name",
      body: "We use MusicBrainz — the public database behind album credits.",
    },
    {
      title: "Confirm it's you",
      body: "Pick your name from the list. Use the subtitle if two artists share a name.",
    },
    {
      title: "Earnings find you",
      body: CONTRIBUTOR_IDENTITY_COPY.doctrine.body,
    },
  ],
  searchPlaceholder: CONTRIBUTOR_IDENTITY_COPY.communities.music.searchPlaceholder,
  searching: CONTRIBUTOR_IDENTITY_COPY.communities.music.searching,
  noResults: CONTRIBUTOR_IDENTITY_COPY.communities.music.noResults,
  needAccount: CONTRIBUTOR_IDENTITY_COPY.needAccount,
  confirmButton: CONTRIBUTOR_IDENTITY_COPY.communities.music.confirmButton,
  confirmedButton: CONTRIBUTOR_IDENTITY_COPY.communities.music.confirmedButton,
  linkedTitle: "You're set up",
  linkedBody: CONTRIBUTOR_IDENTITY_COPY.communities.music.linkedBody,
  linkedToast: CONTRIBUTOR_IDENTITY_COPY.communities.music.linkedToast,
  errorSearch: CONTRIBUTOR_IDENTITY_COPY.communities.music.errorSearch,
  errorLink: CONTRIBUTOR_IDENTITY_COPY.communities.music.errorLink,
} as const;
