import type { Metadata } from "next";
import { Suspense } from "react";
import PaymentsPageClient from "../payments/payments-page-client";

export const metadata: Metadata = {
  title: "Capital — RESOLVE",
  description: "Where should money move? Treasury, claims, settlement.",
};

export default function CapitalPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-resolve-muted">Loading capital…</p>}>
      <PaymentsPageClient />
    </Suspense>
  );
}
