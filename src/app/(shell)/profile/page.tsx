import { Suspense } from "react";
import { ProfileShell } from "@/components/resolve/profile/profile-shell";
import { ProfileSectionSkeleton } from "@/components/resolve/profile/profile-section-skeleton";
import { ProfileEarningsServer } from "@/components/resolve/profile/profile-earnings-server";
import { ProfileWorkServer } from "@/components/resolve/profile/profile-work-server";
import { ProfileInstallationsServer } from "@/components/resolve/profile/profile-installations-server";
import { ProfileBootstrapProvider } from "@/components/resolve/profile/profile-bootstrap";
import { ProfileContributorIdentity } from "@/components/resolve/profile/profile-contributor-identity";
import { ProfileConnectorTracks } from "@/components/resolve/profile/profile-connector-tracks";
import { ProfileSettings } from "@/components/resolve/profile/profile-settings";

export default function ProfilePage() {
  return (
    <ProfileShell>
      <Suspense fallback={<ProfileSectionSkeleton label="Your earnings" />}>
        <ProfileEarningsServer />
      </Suspense>

      <Suspense fallback={<ProfileSectionSkeleton label="Your connected work" />}>
        <ProfileWorkServer />
      </Suspense>

      <ProfileBootstrapProvider>
        <ProfileContributorIdentity />
        <ProfileConnectorTracks />

        <Suspense fallback={<ProfileSectionSkeleton label="RESOLVE installations" />}>
          <ProfileInstallationsServer />
        </Suspense>

        <ProfileSettings />
      </ProfileBootstrapProvider>
    </ProfileShell>
  );
}
