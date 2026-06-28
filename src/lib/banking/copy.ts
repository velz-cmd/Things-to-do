/** Plain-language labels — backend stays Arc/Circle; UI speaks like a bank. */

export const BANKING_UI = {
  eyebrow: "Capital",
  title: "Where should money move?",
  subtitle: "Add money, fund programs, collect earnings — one account for everyone. No interest, no lending.",
  guestTitle: "Your money, one simple account",
  guestBody:
    "Sign in once. Add dollars when you need to fund a program. Collect earnings when contributors pay you. Works whether or not you use crypto.",
  balanceLabel: "Available balance",
  balanceHint: "Ready to fund programs you run — includes Arc faucet & transfers",
  addMoney: "Add money",
  collectEarnings: "Collect earnings",
  connections: "Account settings",
  signIn: "Sign in — it’s free",
  reserved: "Set aside for programs",
  totalIn: "Total added",
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
  claimTitle: "Collect your earnings",
  claimBody: "Matched to your GitHub identity and sent to your account wallet.",
  claimEmpty: "Nothing to collect yet — earnings appear here when programs pay you.",
  claimButton: "Collect earnings",
  claimWorking: "Sending to your wallet…",
  linkGithub: "Link GitHub on Profile so we can match earnings to you.",
  activityEmpty: "No activity yet — add money or join a program to get started.",
  technicalDetails: "Technical details",
  technicalHint: "For crypto users — Arc USDC, Circle wallet, on-chain receipts",
  walletAddress: "Your wallet address",
  copyAddress: "Copy address",
  copied: "Copied",
  networkPulse: "Across RESOLVE",
  verifiedPayment: "Verified payment",
  pendingPayment: "Pending",
} as const;

export function friendlyStatementLabel(label: string): string {
  return label
    .replace(/^Arc USDC deposit$/i, "Money added")
    .replace(/^Arc wallet sync$/i, "Money added from Arc wallet")
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
