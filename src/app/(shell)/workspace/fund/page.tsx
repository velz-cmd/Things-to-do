import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WorkspaceFundRedirect({ searchParams }: PageProps) {
  const params = await searchParams;
  const owner = typeof params.owner === "string" ? params.owner : undefined;
  const repo = typeof params.repo === "string" ? params.repo : undefined;
  const q = owner && repo ? `?owner=${owner}&repo=${repo}` : "";
  redirect(`/mission/fund${q}`);
}
