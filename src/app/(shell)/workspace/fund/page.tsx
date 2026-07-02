import { redirectToMissionFund } from "@/lib/workspace/legacy-redirect";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function WorkspaceFundRedirect({ searchParams }: PageProps) {
  redirectToMissionFund(await searchParams);
}
