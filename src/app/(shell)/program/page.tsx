import type { Metadata } from "next";
import { Suspense } from "react";
import { Sparkles } from "lucide-react";
import { ProductPage } from "@/components/resolve/layout/product-page";
import { EcosystemBenefitsProgram } from "@/components/resolve/capital/ecosystem-benefits-program";
import { RoleInfrastructureHub } from "@/components/resolve/infrastructure/role-infrastructure-hub";

export const metadata: Metadata = {
  title: "Ecosystem Program — RESOLVE",
  description:
    "Professional economic infrastructure for funders, founders, operators, and DAOs — earn, fund, operate, repay, and settle on Arc.",
};

export default function ProgramPage() {
  return (
    <ProductPage
      icon={Sparkles}
      title="Economic infrastructure"
      description="Programmable economy layer on Arc — seven entry doors, six profit engines, five capital modes. Funders, founders, operators, and DAOs each have a professional path with proof on every flow."
      workflows={[
        { label: "Funder" },
        { label: "Founder" },
        { label: "Operator" },
        { label: "DAO" },
      ]}
      width="wide"
      accent="emerald"
    >
      <Suspense fallback={<p className="text-sm text-resolve-muted">Loading infrastructure…</p>}>
        <div className="space-y-16">
          <RoleInfrastructureHub variant="full" defaultRole="funder" />
          <EcosystemBenefitsProgram variant="full" />
        </div>
      </Suspense>
    </ProductPage>
  );
}
