export const queryKeys = {
  profileBootstrap: ["profile", "bootstrap"] as const,
  discoverRadarFeed: (limit = 24) => ["discover", "radar-feed", limit] as const,
  capitalWallet: ["capital", "wallet"] as const,
  profileEarnings: ["profile", "earnings"] as const,
  communities: ["communities", "list"] as const,
};
