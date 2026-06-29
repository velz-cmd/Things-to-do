import type { Metadata } from "next";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { ProductPage } from "@/components/resolve/layout/product-page";
import { EcosystemBenefitsProgram } from "@/components/resolve/capital/ecosystem-benefits-program";

export const metadata: Metadata = {
  title: "Ecosystem Program — RESOLVE",
  description:
    "Everyone benefits from RESOLVE — creators, funders, founders, operators, and audience. Your path explained.",
};

export default function ProgramPage() {
  return (
    <ProductPage
      icon={Sparkles}
      title="Everyone benefits"
      description="RESOLVE discovers value that already exists upstream, records what is owed, and fulfills when capital arrives. Pick your role — creators, funders, founders, operators, and audience each have a clear path."
      workflows={[
        { label: "Creator" },
        { label: "Funder" },
        { label: "Founder" },
        { label: "Audience" },
      ]}
      width="wide"
      accent="emerald"
    >
      <Suspense fallback={<p className="text-sm text-resolve-muted">Loading program…</p>}>
        <EcosystemBenefitsProgram variant="full" />
      </Suspense>
    </ProductPage>
  );
}
