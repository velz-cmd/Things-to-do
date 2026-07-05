import { JellyfinConnectBridge } from "@/components/resolve/connect/jellyfin-connect-bridge";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function safeReturnTo(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.startsWith("/") ? raw : "/profile";
}

export default async function ConnectJellyfinPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo ?? params.returnUrl);
  return <JellyfinConnectBridge returnTo={returnTo} />;
}
