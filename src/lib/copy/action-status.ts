/** In-progress and outcome copy for user actions — never "try again" on normal slow paths. */

export const ACTION_STATUS = {
  /** Shown in spinners / progress while the server works */
  workingInstall: "Attaching community…",
  workingProgram: "Creating program…",
  workingFund: "Recording your contribution…",
  workingDeploy: "Settling on Arc…",
  workingAction: "Working…",

  /** Rare edge: client gave up waiting but server may still finish */
  acceptedBackground:
    "Still confirming on Arc — open Capital to see pending status. You are not charged twice.",

  fundPendingArc:
    "Arc is confirming your USDC transfer. Balance stays reserved until it completes or reverses.",

  arcBalanceLoading: "Loading Arc balance from testnet…",
  arcBalanceCached: "Using last known Arc balance.",
  arcBalanceUnavailable: "Arc balance unavailable right now.",

  metricsLoading: "Loading community metrics…",
  metricsCachedBanner:
    "Showing cached totals while live program and obligation data loads.",
  obligationsLoading: "Loading payee details…",

  discoveryEmpty:
    "No ranked opportunities yet — attach a community below.",
  networkPulseEmpty:
    "No network activity ranked yet — programs appear as ledger rows settle.",
} as const;
