"use client";

import { Suspense } from "react";
import { User } from "lucide-react";
import { ProductPage } from "@/components/resolve/layout/product-page";
import { ProfileSettings } from "@/components/resolve/profile/profile-settings";
import { ProfileInstalledCommunities } from "@/components/resolve/profile/profile-installed-communities";
import { ProfileConnectorTracks } from "@/components/resolve/profile/profile-connector-tracks";
import { ProfileEarningsSummary } from "@/components/resolve/profile/profile-earnings-summary";
import { ProfileContributorIdentity } from "@/components/resolve/profile/profile-contributor-identity";
import { ProfileBootstrapProvider } from "@/components/resolve/profile/profile-bootstrap";

export default function ProfilePage() {
  return (
    <ProductPage
      icon={User}
      title="Who am I in this ecosystem?"
      description="RESOLVE attaches to communities you already use — GitHub, Jellyfin, music servers, and more. Connect once per community so we can credit you when work happens upstream. Your audience doesn't need RESOLVE."
      workflows={[
        { label: "Open source" },
        { label: "Music" },
        { label: "Video" },
        { label: "Get paid" },
      ]}
      width="narrow"
      accent="blue"
    >
      <Suspense fallback={<p className="text-sm text-resolve-muted">Loading profile…</p>}>
        <p className="mb-6 text-right">
          <a href="/settings" className="text-xs text-resolve-accent hover:underline">
            Settings — connectors & keys →
          </a>
        </p>
        <ProfileBootstrapProvider>
          <div className="space-y-10">
            <ProfileEarningsSummary />
            <ProfileContributorIdentity />
            <ProfileConnectorTracks />
            <ProfileInstalledCommunities />
            <ProfileSettings />
          </div>
        </ProfileBootstrapProvider>
      </Suspense>
    </ProductPage>
  );
}
