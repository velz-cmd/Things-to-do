import type { Metadata } from "next";
import { Suspense } from "react";
import {
  CapitalCommandCenter,
  CapitalCommandSkeleton,
} from "@/components/resolve/capital/capital-command-center";
import { getSessionUser } from "@/lib/auth/session";
import { loadCapitalBootstrap } from "@/lib/capital/bootstrap";

export const metadata: Metadata = {
  title: "Capital — RESOLVE",
  description: "Treasury control, authorization, settlement, reconciliation, and receipts.",
};

export default async function CapitalPage() {
  const user = await getSessionUser();
  const initialData = user ? await loadCapitalBootstrap(user).catch(() => null) : null;
  return (
    <Suspense fallback={<CapitalCommandSkeleton />}>
      <CapitalCommandCenter initialData={initialData} />
    </Suspense>
  );
}
