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

export const metadata: Metadata = {
  title: "Capital — RESOLVE",
  description: "Treasury control, authorization, settlement, reconciliation, and receipts.",
};

export default async function CapitalPage() {
  const user = await getSessionUser();
  const initialData = user
    ? await withTimeout(
        loadCapitalBootstrap(user).catch(() => offlineCapitalBootstrap(user)),
        7_000,
        offlineCapitalBootstrap(user),
      )
    : null;
  return (
    <Suspense fallback={<CapitalCommandSkeleton />}>
      <CapitalOperations initialData={initialData} />
    </Suspense>
  );
}
