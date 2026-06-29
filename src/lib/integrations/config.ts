/** Integration env helpers — never log secret values. */

export function env(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

export function isConfigured(key: string): boolean {
  return Boolean(env(key));
}

export const INTEGRATIONS = {
  github: () => isConfigured("GITHUB_TOKEN"),
  openRouter: () => isConfigured("OPENROUTER_API_KEY"),
  groq: () => isConfigured("GROQ_API_KEY"),
  librariesIo: () => isConfigured("LIBRARIES_IO_API_KEY"),
  openAlex: () => true,
  blockscout: () => isConfigured("BLOCKSCOUT_API_KEY"),
  npmRegistry: () => isConfigured("NPM_REGISTRY_TOKEN"),
  dockerHub: () =>
    isConfigured("DOCKER_HUB_USERNAME") && isConfigured("DOCKER_HUB_TOKEN"),
  alchemy: () => isConfigured("ALCHEMY_API_KEY"),
  etherscan: () => isConfigured("ETHERSCAN_API_KEY"),
  openCollective: () => isConfigured("OPENCOLLECTIVE_TOKEN"),
  discord: () => isConfigured("DISCORD_BOT_TOKEN"),
  mastodon: () =>
    isConfigured("MASTODON_INSTANCE_URL") && isConfigured("MASTODON_ACCESS_TOKEN"),
  crossref: () => true,
  arxiv: () => true,
  overpass: () => true,
} as const;

export function getBlockscoutChainId(): number {
  return Number(env("BLOCKSCOUT_CHAIN_ID") ?? env("ARC_CHAIN_ID") ?? "5042002");
}

export function getArcExplorerUrl(): string {
  return env("ARC_EXPLORER_URL") ?? "https://testnet.arcscan.app";
}
