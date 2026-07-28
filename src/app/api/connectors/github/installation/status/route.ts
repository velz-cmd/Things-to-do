import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import { reconcileGithubInstallation } from "@/lib/integrations/github-installation-reconcile";

export const dynamic = "force-dynamic";

function response(body: Record<string, unknown>) {
  return NextResponse.json(body, {
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

/**
 * Reconcile a previously installed GitHub App with the signed-in RESOLVE user.
 * This lets an installation completed on GitHub become available across every
 * product tab even when the browser did not return through the callback.
 */
export async function GET() {
  const authUser = await getSessionUser();
  if (!authUser) return response({ ok: true, signedIn: false, connected: false });

  try {
    const result = await reconcileGithubInstallation({ userId: authUser.id });
    return response({ ok: true, signedIn: true, ...result });
  } catch (error) {
    console.error("[github/installation/status]", error);
    return response({
      ok: false,
      signedIn: true,
      connected: false,
      retryable: true,
    });
  }
}
