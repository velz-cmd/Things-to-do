"use client";

import dynamic from "next/dynamic";
import { Activity } from "lucide-react";
import { ProductPage } from "@/components/resolve/layout/product-page";
import { Panel } from "@/components/resolve/ui/panel";

const WorkspaceOsDashboard = dynamic(
  () =>
    import("@/components/resolve/workspace/workspace-os-dashboard").then((m) => m.WorkspaceOsDashboard),
  {
    loading: () => <ActivityFeedSkeleton />,
    ssr: false,
  },
);

const ConnectorsPage = dynamic(
  () => import("@/components/resolve/connectors/connectors-page").then((m) => m.ConnectorsPage),
  {
    loading: () => <ActivityFeedSkeleton label="Loading connectors…" />,
    ssr: false,
  },
);

function ActivityFeedSkeleton({ label = "Loading live feed…" }: { label?: string }) {
  return (
    <Panel variant="glass" className="p-10 text-center">
      <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-resolve-border border-t-resolve-accent" />
      <p className="mt-4 text-sm text-resolve-muted">{label}</p>
    </Panel>
  );
}

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
      accent="blue"
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
