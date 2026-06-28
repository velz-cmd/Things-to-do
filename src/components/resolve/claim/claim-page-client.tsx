"use client";

import { Suspense } from "react";
import { Wallet } from "lucide-react";
import { ClaimEntry } from "@/components/resolve/claim/claim-entry";
import { ProductPage } from "@/components/resolve/layout/product-page";

function ClaimPageContent() {
  return (
    <ProductPage
      icon={Wallet}
      title="Claim earnings"
      description="Collect authorized value from your notification link or signed-in account."
      width="narrow"
      accent="emerald"
    >
      <ClaimEntry embedded />
    </ProductPage>
  );
}

export function ClaimPageClient() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-12 text-sm text-resolve-muted">
          Loading…
        </div>
      }
    >
      <ClaimPageContent />
    </Suspense>
  );
}
