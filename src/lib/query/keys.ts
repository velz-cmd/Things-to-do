export const queryKeys = {
  profileBootstrap: ["profile", "bootstrap"] as const,
  profileState: ["profile", "state"] as const,
  userConnections: ["profile", "connections"] as const,
  profileWork: ["profile", "work"] as const,
  discoverRadarFeed: (limit = 24) => ["discover", "radar-feed", limit] as const,
  capitalWallet: ["capital", "wallet"] as const,
  capitalState: ["capital", "state"] as const,
  fundingIntent: (id: string) => ["capital", "funding-intent", id] as const,
  settlementBatch: (id: string) => ["capital", "settlement-batch", id] as const,
  myPoolStakes: ["capital", "my-stakes"] as const,
  profileEarnings: ["profile", "earnings"] as const,
  communities: ["communities", "list"] as const,
  communitySurface: (slug: string, mode: "lite" | "full" = "lite") =>
    ["communities", "surface", slug, mode] as const,
  communityIdentities: (slug: string) => ["communities", "identities", slug] as const,
  communityObligations: (slug: string) => ["communities", "obligations", slug] as const,
};
