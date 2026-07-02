import { redirect } from "next/navigation";
import { missionFundHref } from "@/lib/mission/fund-redirect";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function MissionFundRedirect({ searchParams }: PageProps) {
  const sp = await searchParams;
  const owner = typeof sp.owner === "string" ? sp.owner : undefined;
  const repo = typeof sp.repo === "string" ? sp.repo : undefined;
  const amountRaw = typeof sp.amount === "string" ? sp.amount : undefined;
  const amountUsd = amountRaw ? Number(amountRaw.replace(/[^0-9.]/g, "")) : undefined;

  redirect(
    missionFundHref({
      owner,
      repo,
      amountUsd: Number.isFinite(amountUsd) ? amountUsd : undefined,
    })
  );
}
