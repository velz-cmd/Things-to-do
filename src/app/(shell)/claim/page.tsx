import type { Metadata } from "next";
import { ClaimPageClient } from "@/components/resolve/claim/claim-page-client";

export const metadata: Metadata = {
  title: "Claim earnings — RESOLVE",
  description: "Collect authorized value from open communities on Arc.",
};

export default function ClaimPage() {
  return <ClaimPageClient />;
}
