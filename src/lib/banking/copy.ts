/** Plain-language labels — backend stays Arc/Circle; UI speaks like a bank. */

export const BANKING_UI = {
  eyebrow: "Capital",
  title: "Where should money move?",
  subtitle: "Add money, fund programs, collect earnings — one account for everyone. No interest, no lending.",
  guestTitle: "Your money, one simple account",
  guestBody:
    "Sign in once. Add dollars when you need to fund a program. Collect earnings when contributors pay you. Works whether or not you use crypto.",
  balanceLabel: "Available balance",
  balanceHint: "Real USDC in your Arc wallet — synced automatically",
  addMoney: "Add money",
  sendMoney: "Send",
  collectEarnings: "Collect earnings",
  connections: "Account settings",
  signIn: "Sign in — it’s free",
  reserved: "Set aside for programs",
  totalIn: "In your Arc wallet",
  readyToClaim: "Ready to collect",
  activity: "Activity",
  programs: "Programs",
  overview: "Overview",
  howItWorks: [
    { step: "1", title: "Sign in", body: "Email or GitHub — we create one secure wallet for you." },
    { step: "2", title: "Add money", body: "Transfer or crypto — shows up as dollars in your account." },
    { step: "3", title: "Fund or earn", body: "Pay contributors from your balance, or collect what you earned." },
  ],
  pendingFunding:
    "Some payouts are recognized but waiting for the program owner to add money first.",
  claimWorking: "Sending to your wallet…",
  refresh: "Refresh",
  refreshing: "Updating…",
  refreshHint: "Sync Arc wallet and reload balance",
  lastUpdated: "Updated",
  autoRefresh: "Balance auto-refreshes every 15 seconds",
  activityEmpty: "No activity yet — add money or join a program to get started.",
  technicalDetails: "Payment infrastructure",
  technicalHint: "How your USDC moves on Arc — deposits, programs, and verified payouts",
  walletAddress: "Your deposit wallet",
  paymentRailTitle: "Distribution escrow",
  paymentRailBody:
    "RESOLVE-operated Arc wallet that batches program payouts and agent payments. Funded from program owners' balances — not a personal balance.",
  paymentRailStatusLive: "Payout rail operational",
  paymentRailStatusStandby: "Payout rail on standby",
  paymentFlowTitle: "How money moves",
  paymentFlow: [
    "You deposit USDC to your RESOLVE wallet",
    "You fund open-source programs from your balance",
    "Approved earnings batch through RESOLVE's distribution escrow on Arc",
    "Contributors and agents receive USDC with on-chain receipts",
  ],
  claimNothing: "Nothing to collect right now",
  claimSuccess: "Earnings sent to your wallet",
  copyAddress: "Copy address",
  copied: "Copied",
  networkPulse: "Your programs",
  verifiedPayment: "Verified payment",
  pendingPayment: "Pending",
} as const;

export function friendlyStatementLabel(label: string): string {
  return label
    .replace(/^Arc USDC deposit$/i, "Money added")
    .replace(/^Arc wallet sync$/i, "Money added from Arc wallet")
    .replace(/^Balance correction$/i, "Balance corrected to on-chain")
    .replace(/^Program reserve ·/i, "Held for program ·")
    .replace(/^USDC deposit \(Arc\)$/i, "Money added");
}

export function friendlyStatus(status: string): string {
  const map: Record<string, string> = {
    claimable: "Ready to collect",
    authorized: "Recognized",
    settled: "Paid",
    pending_funding: "Waiting for funds",
    CREATED: "Processing",
    COMPLETE: "Paid",
  };
  return map[status] ?? status.replace(/_/g, " ");
}
