import { redirect } from "next/navigation";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function safeReturnTo(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.startsWith("/") ? raw : "/profile";
}

export default async function ConnectListenBrainzPage({ searchParams }: PageProps) {
  const params = await searchParams;
  redirect(
    `/api/connectors/listenbrainz/authorize?returnTo=${encodeURIComponent(
      safeReturnTo(params.returnTo ?? params.returnUrl),
    )}`,
  );
}
