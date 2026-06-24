export type IntakeMessage =
  | { role: "assistant"; content: string }
  | { role: "user"; content: string };

export type IntakeAnswers = {
  role?: string;
  payees?: string[];
  monthlyUsd?: string;
  proofType?: string;
  platform?: string;
  teamSize?: string;
  notes?: string;
};

type StepOption = { id: string; label: string };

export type IntakeStep =
  | {
      id: string;
      question: string;
      options: StepOption[];
      multi?: boolean;
      field: keyof IntakeAnswers;
    }
  | {
      id: "summary";
      question: string;
    };

export function stepsForRole(role: string | undefined): IntakeStep[] {
  const base: IntakeStep[] = [
    {
      id: "role",
      question: "What brings you to RESOLVE?",
      field: "role",
      options: [
        { id: "founder", label: "I'm a founder — distribute rewards & payouts" },
        { id: "company", label: "I run a company or community" },
        { id: "contributor", label: "I complete work and want to get paid on proof" },
        { id: "individual", label: "I need a refund or subscription help" },
      ],
    },
  ];

  if (!role || role === "founder" || role === "company") {
    return [
      ...base,
      {
        id: "payees",
        question: "Who should receive funds? Select all that apply.",
        field: "payees",
        multi: true,
        options: [
          { id: "community", label: "Community members" },
          { id: "team", label: "Core team" },
          { id: "managers", label: "Managers" },
          { id: "marketers", label: "Marketers & growth" },
          { id: "creators", label: "Creators & contributors" },
        ],
      },
      {
        id: "monthlyUsd",
        question: "How much do you plan to distribute per month?",
        field: "monthlyUsd",
        options: [
          { id: "under-500", label: "Under $500" },
          { id: "500-5k", label: "$500 – $5,000" },
          { id: "5k-50k", label: "$5,000 – $50,000" },
          { id: "50k+", label: "$50,000+" },
        ],
      },
      {
        id: "proofType",
        question: "How should RESOLVE verify before paying?",
        field: "proofType",
        options: [
          { id: "events", label: "Verified events (plays, views, milestones)" },
          { id: "bounty", label: "Deliverables (PR merged, work approved)" },
          { id: "both", label: "Both events and deliverables" },
        ],
      },
      { id: "summary", question: "Your distribution plan is ready." },
    ];
  }

  if (role === "contributor") {
    return [
      ...base,
      {
        id: "platform",
        question: "Where does your work live?",
        field: "platform",
        options: [
          { id: "github", label: "GitHub / code" },
          { id: "community", label: "Community / Discord" },
          { id: "creators", label: "Content / creative" },
          { id: "other", label: "Other" },
        ],
      },
      { id: "summary", question: "We can set up a payout mission for you." },
    ];
  }

  return [
    ...base,
    {
      id: "notes",
      question: "What outcome do you need?",
      field: "notes",
      options: [
        { id: "refund", label: "Recover a refund" },
        { id: "cancel", label: "Cancel a subscription" },
        { id: "dispute", label: "Dispute a charge" },
      ],
    },
    { id: "summary", question: "We'll create a recovery mission." },
  ];
}

export function buildIntakeSummary(answers: IntakeAnswers): string {
  const lines: string[] = [];
  if (answers.role) lines.push(`Role: ${answers.role}`);
  if (answers.payees?.length) lines.push(`Payees: ${answers.payees.join(", ")}`);
  if (answers.monthlyUsd) lines.push(`Monthly volume: ${answers.monthlyUsd}`);
  if (answers.proofType) lines.push(`Verification: ${answers.proofType}`);
  if (answers.platform) lines.push(`Platform: ${answers.platform}`);
  if (answers.notes) lines.push(`Outcome: ${answers.notes}`);
  return lines.join(" · ");
}

export type RecommendedAction = {
  type: "distribute" | "bounty" | "recovery";
  label: string;
  detail: string;
  href: string;
};

export function recommendedAction(answers: IntakeAnswers): RecommendedAction {
  if (answers.role === "individual" || answers.notes) {
    return {
      type: "recovery",
      label: "Recovery mission",
      detail: "We'll open a refund or subscription mission with proof-based settlement.",
      href: "/missions?panel=mission&from=intake",
    };
  }
  if (answers.proofType === "bounty" || answers.role === "contributor") {
    return {
      type: "bounty",
      label: "Bounty mission",
      detail: "Set up deliverable-based payouts — PR merge, design approval, milestones.",
      href: "/missions?panel=mission&from=intake",
    };
  }
  return {
    type: "distribute",
    label: "Distribution batch",
    detail: "Open treasury and run a verified payout to your team and community.",
    href: "/missions?panel=distribute&from=intake",
  };
}
