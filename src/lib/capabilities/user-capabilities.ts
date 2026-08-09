export const USER_CAPABILITIES = [
  "can_receive_direct_support",
  "can_claim_work",
  "can_fund_person",
  "can_fund_pool",
  "can_create_community",
  "can_operate_community",
  "can_create_program",
  "can_publish_program",
  "can_authorise_distribution",
  "can_publish_content",
  "can_sell_usage",
  "can_purchase_service",
  "can_view_private_evidence",
  "can_manage_payout",
  "can_reconcile_settlement",
] as const;

export type UserCapability = (typeof USER_CAPABILITIES)[number];

export function deriveUserCapabilities(input: {
  signedIn: boolean;
  payoutReady: boolean;
  identityReady: boolean;
  sourceConnected: boolean;
  repositoryAccess: boolean;
  operatesCommunity: boolean;
  hasPublishedProgram: boolean;
  liveSettlementEnabled: boolean;
  walletReady: boolean;
  hasPublishingAdapter?: boolean;
  hasRegisteredService?: boolean;
}): UserCapability[] {
  const capabilities = new Set<UserCapability>();
  if (!input.signedIn) return [];
  capabilities.add("can_manage_payout");
  capabilities.add("can_create_community");
  if (input.sourceConnected) capabilities.add("can_claim_work");
  if (input.identityReady && input.payoutReady && input.liveSettlementEnabled) capabilities.add("can_receive_direct_support");
  if (input.liveSettlementEnabled && input.walletReady) {
    capabilities.add("can_fund_person");
    capabilities.add("can_fund_pool");
  }
  if (input.repositoryAccess) capabilities.add("can_view_private_evidence");
  if (input.operatesCommunity) {
    capabilities.add("can_operate_community");
    capabilities.add("can_create_program");
    capabilities.add("can_publish_program");
    capabilities.add("can_reconcile_settlement");
    if (input.hasPublishedProgram) capabilities.add("can_authorise_distribution");
  }
  if (input.hasPublishingAdapter) {
    capabilities.add("can_publish_content");
    capabilities.add("can_sell_usage");
  }
  if (input.hasRegisteredService) capabilities.add("can_purchase_service");
  return [...capabilities];
}
