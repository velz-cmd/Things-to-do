import type { DiscoverAction } from "@/lib/discover/types";

export type DiscoverOutcomeStep = {
  id: string;
  label: string;
  description: string;
  href: string;
  external?: boolean;
};

const ARC_EXPLORER = process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://testnet.arcscan.app";

export function whereFundGoes(input: {
  communitySlug?: string;
  programName?: string;
  amountUsd: number;
}): string {
  const who = input.communitySlug
    ? `${input.communitySlug.replace(/-/g, " ")} program pool`
    : "this program pool";
  return `$${input.amountUsd.toFixed(2)} USDC moves from your wallet into the ${who} on Arc testnet. It stays reserved until authorizations settle to contributors.`;
}

export function fundOutcomeSteps(input: {
  communitySlug?: string;
  programId?: string;
  txHash?: string;
}): DiscoverOutcomeStep[] {
  const steps: DiscoverOutcomeStep[] = [
    {
      id: "capital",
      label: "Capital · Activity",
      description: "Fund stake, wallet sync, and Arc receipts",
      href: "/capital",
    },
  ];

  if (input.communitySlug) {
    steps.push({
      id: "community",
      label: "Communities · Program pool",
      description: "Rules, budget, and who gets paid",
      href: `/communities/${input.communitySlug}?intent=fund`,
    });
  }

  steps.push({
    id: "discover-board",
    label: "Discover · Ready to Fund",
    description: "Your stake badge updates on opportunity cards",
    href: "/discover#opportunities",
  });

  if (input.txHash) {
    steps.push({
      id: "arcscan",
      label: "Arcscan · On-chain tx",
      description: "Verify the USDC transfer on Arc testnet",
      href: `${ARC_EXPLORER}/tx/${input.txHash}`,
      external: true,
    });
  }

  return steps;
}

export function createProgramOutcomeSteps(input: {
  communitySlug?: string;
  programId?: string;
}): DiscoverOutcomeStep[] {
  const steps: DiscoverOutcomeStep[] = [];

  if (input.communitySlug) {
    steps.push({
      id: "fund-next",
      label: "Fund pool on Arc",
      description: "Add USDC so payouts can settle",
      href: `/discover#opportunities`,
    });
    steps.push({
      id: "automate",
      label: "Set auto-pay rule",
      description: "Pay when verified proof arrives",
      href: `/discover?community=${input.communitySlug}&panel=automate`,
    });
    steps.push({
      id: "community",
      label: "Communities console",
      description: "Edit rules and deploy settlement",
      href: `/communities/${input.communitySlug}?intent=create_program`,
    });
  }

  return steps;
}

export function automateOutcomeSteps(input: { communitySlug?: string }): DiscoverOutcomeStep[] {
  if (!input.communitySlug) return [];
  return [
    {
      id: "panel",
      label: "Tune auto-pay on graph",
      description: "Adjust cap and notifications on Discover",
      href: `/discover?community=${input.communitySlug}&panel=automate`,
    },
    {
      id: "fund",
      label: "Fund the pool",
      description: "USDC must be in the pool before Arc can pay",
      href: "/discover#opportunities",
    },
    {
      id: "capital",
      label: "Capital activity",
      description: "Settlement and wallet history",
      href: "/capital",
    },
  ];
}

export function confirmNextStepHint(action: DiscoverAction): string | undefined {
  switch (action.kind) {
    case "create_program":
      return "After confirm → fund the pool on Arc (min $5 USDC).";
    case "fund":
    case "sponsor":
      return "USDC moves to the program pool · activity appears in Capital.";
    case "install":
      return "After attach → create a program or fund from Discover.";
    case "analyze":
      return "Proof syncs to the ledger · fund or automate when verified.";
    case "automate":
      return "Opens auto-pay builder on Discover — go live on Arc when proof arrives.";
    default:
      return undefined;
  }
}
