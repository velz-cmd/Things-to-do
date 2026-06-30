/** Shared types for signal rail catalog UI. */
export type SignalLane = "agent" | "creator" | "maintainer";

export type PremiumSignalService = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  priceUsd: number;
  billingUnit: string;
  domain: string;
  eventType: string;
  connectorId: string;
  rfbProgram?: string;
  examplePrompt: string;
  x402: boolean;
};
