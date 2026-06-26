"use client";

import { Activity } from "lucide-react";
import { ProductPage } from "@/components/resolve/layout/product-page";
import { WorkspaceOsDashboard } from "@/components/resolve/workspace/workspace-os-dashboard";
import { ConnectorsPage } from "@/components/resolve/connectors/connectors-page";

/** GitHub-style activity feed + connector pulse — value in motion. */
export function ActivitySurface() {
  return (
    <ProductPage
      icon={Activity}
      title="Activity"
      description="Live value recognition across open ecosystems. See where value enters, who earned it, and what needs attention."
      workflows={[
        { label: "Live feed", active: true },
        { label: "Connected sources" },
        { label: "Today's timeline" },
      ]}
      width="wide"
    >
      <div className="space-y-10">
        <WorkspaceOsDashboard />
        <section className="border-t border-resolve-border/60 pt-10">
          <ConnectorsPage embedded />
        </section>
      </div>
    </ProductPage>
  );
}
