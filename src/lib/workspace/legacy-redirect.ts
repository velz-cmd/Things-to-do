import { redirect } from "next/navigation";

type SearchParams = Record<string, string | string[] | undefined>;

/** Preserve query params when redirecting legacy routes to Workspace. */
export function redirectToWorkspace(searchParams: SearchParams) {
  const owner = typeof searchParams.owner === "string" ? searchParams.owner : undefined;
  const repo = typeof searchParams.repo === "string" ? searchParams.repo : undefined;
  const q = owner && repo ? `?owner=${owner}&repo=${repo}` : "";
  redirect(`/workspace/fund${q}`);
}

type LegacyPageProps = {
  searchParams: Promise<SearchParams>;
};

export default async function legacyWorkspaceRedirect({ searchParams }: LegacyPageProps) {
  redirectToWorkspace(await searchParams);
}
