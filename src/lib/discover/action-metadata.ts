import type { DiscoverAction, DiscoverActionKind } from "@/lib/discover/types";

const AUTH_REQUIRED: DiscoverActionKind[] = [
  "fund",
  "install",
  "create_program",
  "claim",
  "connect_sensor",
  "sponsor",
  "share",
];

const API_BY_KIND: Partial<Record<DiscoverActionKind, string>> = {
  fund: "POST /api/capital/fund",
  sponsor: "POST /api/capital/fund",
  install: "POST /api/communities/{slug}/install",
  create_program: "POST /api/communities/{slug}/programs",
  share: "GET /api/receipt/{id}",
  claim: "GET /claim",
  connect_sensor: "POST /api/communities/{slug}/install",
  console: "Discover community console",
  open: "navigation",
  analyze: "navigation",
};

export function requiredDataForAction(action: DiscoverAction): string[] {
  const needs: string[] = [];
  if (action.programId) needs.push(`programId:${action.programId}`);
  if (action.missionId) needs.push(`missionId:${action.missionId}`);
  if (action.communitySlug) needs.push(`communitySlug:${action.communitySlug}`);
  if (action.templateId) needs.push(`templateId:${action.templateId}`);
  if (action.entityPath) needs.push(`entityPath:${action.entityPath}`);
  if (action.href) needs.push(`href:${action.href}`);
  if (action.amountUsd != null) needs.push(`amountUsd:${action.amountUsd}`);
  if (!needs.length) needs.push("(navigation only)");
  return needs;
}

export function apiEndpointForAction(action: DiscoverAction): string | null {
  if (action.kind === "fund" || action.kind === "sponsor") {
    if (!action.programId && !action.communitySlug && !action.missionId) return null;
    if (!action.programId) return "GET /api/discover/fund-target → chain install/create → POST /api/capital/fund";
    return API_BY_KIND[action.kind] ?? null;
  }
  return API_BY_KIND[action.kind] ?? null;
}

export function actionRequiresAuth(kind: DiscoverActionKind): boolean {
  return AUTH_REQUIRED.includes(kind);
}
