import { OAuthConnectBridge } from "@/components/resolve/connect/oauth-connect-bridge";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function safeReturnTo(value: string | string[] | undefined) {
  const raw = Array.isArray(value) ? value[0] : value;
  return raw?.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\")
    ? raw
    : "/profile?view=sources";
}

export default async function InstallGithubAppPage({ searchParams }: PageProps) {
  const params = await searchParams;
  return (
    <OAuthConnectBridge
      provider="github_app"
      returnTo={safeReturnTo(params.returnTo ?? params.returnUrl)}
    />
  );
}
