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
    "Submitted — finishing in the background. Capital and Communities update when complete.",

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
