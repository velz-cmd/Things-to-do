/** Plain-language labels — backend stays Arc/Circle; UI speaks like a bank. */

export const BANKING_UI = {
  eyebrow: "Capital",
  title: "Your treasury",
  subtitle: "Arc USDC balance, earnings to collect, sends, and activity — fund programs from Communities.",
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
  reserved: "Held for payouts",
  totalIn: "On-chain USDC",
  readyToClaim: "Earnings to collect",
  activity: "Activity",
  treasury: "Treasury",
  overview: "Overview",
  howItWorks: [
    { step: "1", title: "Sign in", body: "Email or GitHub — we create one secure wallet for you." },
    { step: "2", title: "Add money", body: "Transfer or crypto — shows up as dollars in your account." },
    { step: "3", title: "Collect or send", body: "Claim earnings to your wallet or send USDC when you are ready." },
  ],
  pendingFunding:
    "Some payouts are recognized but waiting for the program owner to add money first.",
  claimWorking: "Sending to your wallet…",
  refresh: "Refresh",
  refreshing: "Updating…",
  syncingBalance: "Loading Arc balance…",
  refreshHint: "Sync faucet deposits from Arc testnet",
  lastUpdated: "Updated",
  autoRefresh: "Auto-refresh every 30s",
  activityEmpty: "No activity yet — add USDC or collect earnings to see movement here.",
  technicalDetails: "Payment infrastructure",
  technicalHint: "Deposit address, on-chain balance, and payout rail on Arc testnet",
  walletAddress: "Your deposit wallet",
  paymentRailTitle: "Distribution escrow",
  paymentRailBody:
    "RESOLVE-operated Arc wallet that batches program payouts and agent payments. Funded from program owners' balances — not a personal balance.",
  paymentRailStatusLive: "Payout rail operational",
  paymentRailStatusStandby: "Payout rail on standby",
  paymentFlowTitle: "How money moves",
  paymentFlow: [
    "You deposit USDC to your RESOLVE wallet on Arc",
    "Verified earnings become claimable in Capital",
    "Approved payouts batch through RESOLVE on Arc",
    "You receive USDC with on-chain receipts",
  ],
  claimNothing: "Nothing to collect right now",
  claimSuccess: "Earnings sent to your wallet",
  copyAddress: "Copy address",
  copied: "Copied",
  networkPulse: "Network",
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
