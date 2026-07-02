/** Build Mission URL for fund/decide flows (replaces legacy /mission/fund). */

export function missionFundHref(input?: {
  owner?: string;
  repo?: string;
  amountUsd?: number;
}): string {
  const owner = input?.owner?.trim();
  const repo = input?.repo?.trim();
  if (owner && repo) {
    let prompt = `Fund ${owner}/${repo} — analyze attribution and recommend allocation`;
    if (input?.amountUsd && input.amountUsd > 0) {
      prompt += ` with $${Math.round(input.amountUsd).toLocaleString()} USDC`;
    }
    return `/mission?prompt=${encodeURIComponent(prompt)}`;
  }
  return "/mission";
}
