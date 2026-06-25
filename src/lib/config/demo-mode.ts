/** Server-side demo / hackathon mode flags. */

export function isDeputyDemoMode(): boolean {
  return process.env.DEPUTY_DEMO_MODE === "true";
}

/** Card/bank instant credit — only when explicitly in demo mode. */
export function isCardOnRampEnabled(): boolean {
  return isDeputyDemoMode();
}
