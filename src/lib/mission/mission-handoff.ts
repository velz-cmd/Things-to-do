import type { MissionBlueprintPackage } from "@/lib/mission/mission-blueprint-package";

/** Discover → Mission scoped fund handoff. */
export function discoverToMissionHref(input: {
  scope: string;
  intent?: "fund" | "agent" | "simulate";
  serviceId?: string;
  prompt?: string;
}): string {
  const params = new URLSearchParams();
  params.set("scope", input.scope);
  if (input.intent) params.set("intent", input.intent);
  if (input.serviceId) params.set("service", input.serviceId);
  if (input.prompt) params.set("prompt", input.prompt);
  return `/mission?${params.toString()}`;
}

/** Mission approve → Capital pre-filled execution view. */
export function capitalHandoffFromBlueprint(
  pkg: MissionBlueprintPackage,
  context?: { fundingIntentId?: string; returnTo?: string },
): string {
  const params = new URLSearchParams();
  params.set("tab", "activity");
  if (pkg.programId) params.set("program", pkg.programId);
  params.set("community", pkg.communitySlug);
  if (pkg.id) params.set("missionReport", pkg.id);
  if (context?.fundingIntentId) params.set("fundingIntent", context.fundingIntentId);
  if (context?.returnTo) params.set("returnTo", context.returnTo);
  return `/capital?${params.toString()}`;
}

/** Mission → Communities install rail. */
export function communitiesInstallHandoff(communitySlug: string, templateId?: string): string {
  const params = new URLSearchParams({ intent: "install" });
  if (templateId) params.set("template", templateId);
  return `/communities/${encodeURIComponent(communitySlug)}?${params.toString()}`;
}

/** Mission → Profile claim earnings. */
export function profileClaimHandoff(): string {
  return "/profile?tab=earnings";
}
