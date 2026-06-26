import { Suspense } from "react";
import { ClaimEntry } from "@/components/resolve/claim/claim-entry";
import { ProductPage } from "@/components/resolve/layout/product-page";
import { Wallet } from "lucide-react";

export default function ClaimPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-lg px-4 py-12 text-sm text-resolve-muted">
          Loading…
        </div>
      }
    >
      <ProductPage
        icon={Wallet}
        title="Claim earnings"
        description="Collect authorized value from your notification link or signed-in account."
        width="narrow"
        accent="emerald"
      >
        <ClaimEntry embedded />
      </ProductPage>
    </Suspense>
  );
}
