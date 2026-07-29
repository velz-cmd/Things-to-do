import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CapitalCommandSkeleton,
} from "@/components/resolve/capital/capital-command-center";
import { CapitalOperations } from "@/components/resolve/capital/capital-operations";
import { getSessionUser } from "@/lib/auth/session";
import { loadCapitalBootstrap } from "@/lib/capital/bootstrap";
import { offlineCapitalBootstrap } from "@/lib/capital/bootstrap-fallback";
import { withTimeout } from "@/lib/discover/fetch-timeout";
import { loadWorkspaceReadiness } from "@/lib/workspace/readiness";

export const metadata: Metadata = {
  title: "Capital — RESOLVE",
  description: "Treasury control, authorization, settlement, reconciliation, and receipts.",
};

async function CapitalContent() {
  const user = await getSessionUser();
  const readiness = user
    ? await withTimeout(loadWorkspaceReadiness(user.id).catch(() => null), 1_500, null)
    : null;
  const initialData = user
    ? await withTimeout(
        loadCapitalBootstrap(user).catch(() => offlineCapitalBootstrap(user, readiness)),
        7_000,
        offlineCapitalBootstrap(user, readiness),
      )
    : null;
  return <CapitalOperations initialData={initialData} />;
}

export default function CapitalPage() {
  return (
    <Suspense fallback={<CapitalCommandSkeleton />}>
      <CapitalContent />
    </Suspense>
  );
}
