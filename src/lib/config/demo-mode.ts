/** Server-side demo / hackathon mode flags. */

export function isProductionDeploy(): boolean {
  return process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production";
}

export function isDeputyDemoMode(): boolean {
  // Production deploys are always honest — judges and external users see real flows only.
  if (isProductionDeploy()) {
    return false;
  }
  return process.env.DEPUTY_DEMO_MODE === "true";
}

/** Card/bank instant credit — only when explicitly in demo mode. */
export function isCardOnRampEnabled(): boolean {
  return isDeputyDemoMode();
}
