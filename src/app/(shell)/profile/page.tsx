"use client";

import { Suspense } from "react";
import { User } from "lucide-react";
import { ProductPage } from "@/components/resolve/layout/product-page";
import { ProfileSettings } from "@/components/resolve/profile/profile-settings";
import { ProfileInstalledCommunities } from "@/components/resolve/profile/profile-installed-communities";
import { ProfileConnectorTracks } from "@/components/resolve/profile/profile-connector-tracks";
import { ProfileEarningsSummary } from "@/components/resolve/profile/profile-earnings-summary";
import { ProfileMusicBrainzRegistry } from "@/components/resolve/profile/profile-musicbrainz-registry";
import { ProfileBootstrapProvider } from "@/components/resolve/profile/profile-bootstrap";

export default function ProfilePage() {
  return (
    <ProductPage
      icon={User}
      title="Who am I in this ecosystem?"
      description="Connect where each community lives — code, music, research, settlement. One identity layer for funding open communities."
      workflows={[
        { label: "Open source" },
        { label: "Music" },
        { label: "Settlement" },
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
            <ProfileMusicBrainzRegistry />
            <ProfileConnectorTracks />
            <ProfileInstalledCommunities />
            <ProfileSettings />
          </div>
        </ProfileBootstrapProvider>
      </Suspense>
    </ProductPage>
  );
}
