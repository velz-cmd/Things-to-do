export interface ProblemStat {
  label: string;
  value: string;
  description: string;
  sourceName: string;
  sourceUrl: string;
  year: string;
}

export const problemStats: ProblemStat[] = [
  {
    label: "Subscription complaints",
    value: "Nearly 70/day",
    description:
      "FTC reported negative-option subscription complaints averaged nearly 70 per day in 2024, up from 42 per day in 2021.",
    sourceName: "FTC",
    sourceUrl: "https://www.ftc.gov/news-events/news/press-releases/2024/10/federal-trade-commission-announces-final-rule-banning-fake-reviews-testimonials",
    year: "2024",
  },
  {
    label: "Accidental subscriptions",
    value: "£688M",
    description:
      "Citizens Advice reported UK consumers spent about £688 million on accidental subscriptions in a year.",
    sourceName: "Citizens Advice / The Guardian",
    sourceUrl:
      "https://www.theguardian.com/money/2024/mar/08/spending-accidental-subscriptions-doubled-in-year-uk-citizens-advice",
    year: "2024",
  },
  {
    label: "Internet crime losses",
    value: "$16.6B",
    description:
      "FBI IC3 reported $16.6 billion in U.S. internet crime losses in 2024.",
    sourceName: "FBI IC3 / Axios",
    sourceUrl: "https://www.axios.com/2025/04/23/fbi-internet-crime-loss-record-high-2024",
    year: "2024",
  },
  {
    label: "Crypto hacks",
    value: "$2.2B",
    description:
      "Chainalysis estimated crypto hacks stole about $2.2 billion in 2024.",
    sourceName: "Chainalysis / Reuters",
    sourceUrl: "https://www.reuters.com/technology/cybersecurity/crypto-hacks-stole-22-bln-2024-chainalysis-says-2024-12-19/",
    year: "2024",
  },
];

export const outcomeCategories = [
  {
    id: "refunds",
    title: "Refunds",
    description: "Airline delays, cancelled trips, duplicate charges",
    prompt: "Get a refund from my delayed flight",
    icon: "plane" as const,
  },
  {
    id: "cancellations",
    title: "Cancellations",
    description: "Subscriptions, trials, unused services",
    prompt: "Cancel my unused subscriptions",
    icon: "credit-card" as const,
  },
  {
    id: "claims",
    title: "Claims",
    description: "Parcels, merchant disputes, compensation forms",
    prompt: "Recover compensation for my lost DHL parcel",
    icon: "package" as const,
  },
  {
    id: "protection",
    title: "Protection",
    description: "Wallet approvals, risky contracts, proof-based escrow",
    prompt: "Scan my wallet for risky approvals",
    icon: "shield" as const,
  },
];
