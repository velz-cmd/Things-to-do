/** Server-side demo / hackathon mode flags. */

export function isDeputyDemoMode(): boolean {
  // Production deploys are always honest — judges and external users see real flows only.
  if (process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production") {
    return false;
  }
  return process.env.DEPUTY_DEMO_MODE === "true";
}

/** Card/bank instant credit — only when explicitly in demo mode. */
export function isCardOnRampEnabled(): boolean {
  return isDeputyDemoMode();
}
