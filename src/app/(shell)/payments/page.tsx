import type { Metadata } from "next";
import { Suspense } from "react";
import PaymentsPageClient from "./payments-page-client";

export const metadata: Metadata = {
  title: "Payments — RESOLVE",
  description: "Treasury, settlements, and contributor claims.",
};

export default function PaymentsPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-resolve-muted">Loading payments…</p>}>
      <PaymentsPageClient />
    </Suspense>
  );
}
