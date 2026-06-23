/** ERC-8004 agent identity contracts on Arc Testnet — server-side only */

export const ERC8004_IDENTITY_REGISTRY = (process.env.ERC8004_IDENTITY_REGISTRY ??
  "0x8004A818BFB912233c491871b3d84c89A494BD9e") as `0x${string}`;

export const ERC8004_REPUTATION_REGISTRY = (process.env.ERC8004_REPUTATION_REGISTRY ??
  "0x8004B663056A597Dffe9eCcC1965A193B7388713") as `0x${string}`;

export const ERC8004_VALIDATION_REGISTRY = (process.env.ERC8004_VALIDATION_REGISTRY ??
  "0x8004Cb1BF31DAf7788923b405b754f57acEB4272") as `0x${string}`;

export const RESOLVE_AGENT_METADATA_URI =
  process.env.RESOLVE_AGENT_METADATA_URI ??
  "ipfs://bafkreibdi6623n3xpf7ymk62ckb4bo75o3qemwkpfvp5i25j66itxvsoei";

/** Agent owner registers identity — defaults to provider wallet */
export const ARC_AGENT_OWNER_WALLET_ADDRESS = (process.env
  .ARC_AGENT_OWNER_WALLET_ADDRESS ??
  process.env.ARC_PROVIDER_WALLET_ADDRESS) as `0x${string}` | undefined;

/** External validator records reputation — must differ from owner per ERC-8004 */
export const ARC_AGENT_VALIDATOR_WALLET_ADDRESS = (process.env
  .ARC_AGENT_VALIDATOR_WALLET_ADDRESS ??
  process.env.ARC_CLIENT_WALLET_ADDRESS) as `0x${string}` | undefined;

export function canRegisterAgent(): boolean {
  return Boolean(
    ARC_AGENT_OWNER_WALLET_ADDRESS &&
      ARC_AGENT_VALIDATOR_WALLET_ADDRESS &&
      ARC_AGENT_OWNER_WALLET_ADDRESS.toLowerCase() !==
        ARC_AGENT_VALIDATOR_WALLET_ADDRESS.toLowerCase()
  );
}
