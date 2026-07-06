import type { DiscoverAction, TrendingValueGap } from "@/lib/discover/types";

export type DiscoverOutcomeStep = {
  id: string;
  label: string;
  description: string;
  href: string;
  external?: boolean;
  primary?: boolean;
};

const ARC_EXPLORER = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://testnet.arcscan.app";

/** Copy gap context onto fund/sponsor actions for post-action receipts. */
export function enrichFundActionFromGap(
  action: DiscoverAction,
  gap: Pick<TrendingValueGap, "why" | "whoBenefits" | "headline" | "communitySlug" | "templateId">,
): DiscoverAction {
  if (action.kind !== "fund" && action.kind !== "sponsor") return action;
  return {
    ...action,
    whyFund: action.whyFund ?? gap.why,
    whoBenefits: action.whoBenefits ?? gap.whoBenefits,
    programName: action.programName ?? gap.headline,
    communitySlug: action.communitySlug ?? gap.communitySlug,
    templateId: action.templateId ?? gap.templateId,
  };
}

export type FundOutcomeDetail = {
  amountUsd: number;
  programName?: string;
  communitySlug?: string;
  programId?: string;
  activityId?: string;
  txHash?: string;
  whyFund?: string;
  whoBenefits?: string;
};

export function buildFundOutcomeTitle(input: FundOutcomeDetail): string {
  const amount = `$${input.amountUsd.toFixed(2)}`;
  if (input.programName) {
    return `${amount} added to ${input.programName}`;
  }
  if (input.communitySlug) {
    return `${amount} added to ${input.communitySlug.replace(/-/g, " ")} pool`;
  }
  return `${amount} added to program pool`;
}

export function buildFundOutcomeSummary(input: FundOutcomeDetail): string {
  const dest = input.programName
    ? input.programName
    : input.communitySlug
      ? `${input.communitySlug.replace(/-/g, " ")} program pool`
      : "this program pool";
  return `Your ${input.amountUsd.toFixed(2)} USDC is in the communal pool on Arc. Payouts run automatically when the pool reaches the next milestone — no manual allocation needed.`;
}

/** Capital-first — proof link, then Capital activity. */
export function fundOutcomeSteps(input: FundOutcomeDetail): DiscoverOutcomeStep[] {
  const steps: DiscoverOutcomeStep[] = [];

  if (input.activityId) {
    steps.push({
      id: "proof",
      label: "View proof",
      description: "Activity receipt, pool balance, and settlement trail",
      href: `/receipt/${encodeURIComponent(input.activityId)}`,
      primary: true,
    });
  } else if (input.communitySlug && input.programId) {
    steps.push({
      id: "proof",
      label: "View proof",
      description: "Pool balance, checkpoints, and your stake on Arc",
      href: `/communities/${input.communitySlug}?intent=fund&program=${encodeURIComponent(input.programId)}#pool-checkpoints`,
      primary: true,
    });
  }

  steps.push({
    id: "capital",
    label: "Capital · Your contribution",
    description: `${input.amountUsd.toFixed(2)} stake, balance, and activity receipt`,
    href: "/capital?tab=activity",
    primary: steps.length === 0,
  });

  if (input.communitySlug && input.programId) {
    steps.push({
      id: "program",
      label: "Program · Rules and payees",
      description: "Who gets paid and how this pool spends",
      href: `/communities/${input.communitySlug}?tab=advanced&program=${encodeURIComponent(input.programId)}#programs`,
    });
  }

  if (input.txHash) {
    steps.push({
      id: "arcscan",
      label: "Arcscan · On-chain transfer",
      description: "Verify USDC on Arc testnet",
      href: `${ARC_EXPLORER}/tx/${input.txHash}`,
      external: true,
    });
  }

  return steps.slice(0, 4);
}

/** One next step per completed action — no generic Discover clutter. */
export function outcomeStepsForAction(
  action: DiscoverAction,
  ctx?: { programId?: string; entityId?: string },
): DiscoverOutcomeStep[] {
  switch (action.kind) {
    case "create_program":
      if (!action.communitySlug) return [];
      return [
        {
          id: "fund-next",
          label: "Fund this program on Arc",
          description: "Min $5 USDC — pool must hold funds before payouts",
          href: "/discover#opportunities",
          primary: true,
        },
      ];
    case "install":
      if (!action.communitySlug) return [];
      return [
        {
          id: "create-program",
          label: "Create payout program",
          description: `Set rules for ${action.communitySlug.replace(/-/g, " ")}`,
          href: `/communities/${action.communitySlug}?intent=create_program`,
          primary: true,
        },
      ];
    case "analyze":
      return [
        {
          id: "fund-when-ready",
          label: action.communitySlug ? "Fund when proof is ready" : "Find programs to fund",
          description: "Fund after authorizations appear in the ledger",
          href: action.communitySlug
            ? `/discover#opportunities`
            : "/discover#opportunities",
          primary: true,
        },
      ];
    case "automate":
      if (!action.communitySlug) return [];
      return [
        {
          id: "fund-pool",
          label: "Fund the pool first",
          description: "Auto-pay needs USDC in the program pool",
          href: "/discover#opportunities",
          primary: true,
        },
      ];
    case "fund":
    case "sponsor":
      return fundOutcomeSteps({
        amountUsd: action.amountUsd ?? 5,
        communitySlug: action.communitySlug,
        programId: action.programId ?? ctx?.programId,
        programName: action.programName,
        whyFund: action.whyFund,
        whoBenefits: action.whoBenefits,
      });
    default:
      return [];
  }
}

export function whereFundGoes(input: {
  communitySlug?: string;
  programName?: string;
  amountUsd: number;
}): string {
  return buildFundOutcomeSummary({
    amountUsd: input.amountUsd,
    communitySlug: input.communitySlug,
    programName: input.programName,
  });
}

export function createProgramOutcomeSteps(input: {
  communitySlug?: string;
  programId?: string;
}): DiscoverOutcomeStep[] {
  if (!input.communitySlug) return [];
  return outcomeStepsForAction({
    id: "create",
    label: "Program",
    kind: "create_program",
    communitySlug: input.communitySlug,
    programId: input.programId,
  });
}

export function automateOutcomeSteps(input: { communitySlug?: string }): DiscoverOutcomeStep[] {
  if (!input.communitySlug) return [];
  return outcomeStepsForAction({
    id: "auto",
    label: "Automate",
    kind: "automate",
    communitySlug: input.communitySlug,
  });
}

export function confirmNextStepHint(action: DiscoverAction): string | undefined {
  switch (action.kind) {
    case "create_program":
      return "Next: fund the pool on Arc (min $5 USDC).";
    case "fund":
    case "sponsor":
      return "USDC moves into the program pool — see Capital for your stake.";
    case "install":
      return "Next: create a payout program, then fund.";
    case "analyze":
      return "Proof updates in the ledger — fund when authorizations appear.";
    case "automate":
      return "Fund the pool first — auto-pay runs when proof arrives.";
    default:
      return undefined;
  }
}
