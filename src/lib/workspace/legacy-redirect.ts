import { redirect } from "next/navigation";
import { missionFundHref } from "@/lib/mission/fund-redirect";

type SearchParams = Record<string, string | string[] | undefined>;

/** Preserve query params when redirecting legacy fund routes to Mission. */
export function redirectToMissionFund(searchParams: SearchParams) {
  const owner = typeof searchParams.owner === "string" ? searchParams.owner : undefined;
  const repo = typeof searchParams.repo === "string" ? searchParams.repo : undefined;
  redirect(missionFundHref({ owner, repo }));
}

type LegacyPageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function legacyWorkspaceRedirect({ searchParams }: LegacyPageProps) {
  redirectToMissionFund(await searchParams);
}
