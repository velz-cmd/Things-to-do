function enabled(name: string): boolean {
  return process.env[name]?.trim().toLowerCase() === "true";
}

export const arcFeatureFlags = {
  batchSettlement: enabled("ARC_BATCH_SETTLEMENT_ENABLED"),
  memo: enabled("ARC_MEMO_ENABLED"),
  erc8004: enabled("ARC_ERC8004_ENABLED"),
  erc8183: enabled("ARC_ERC8183_ENABLED"),
  circleGatewayX402: enabled("CIRCLE_GATEWAY_X402_ENABLED"),
} as const;

export type ArcFeatureFlag = keyof typeof arcFeatureFlags;

export function requireArcFeature(feature: ArcFeatureFlag): void {
  if (!arcFeatureFlags[feature]) {
    throw new Error(`${feature} is disabled until its testnet capability checks pass.`);
  }
}
