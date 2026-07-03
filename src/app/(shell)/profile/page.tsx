import { Suspense } from "react";
import { ProfileShell } from "@/components/resolve/profile/profile-shell";
import { ProfileSectionSkeleton } from "@/components/resolve/profile/profile-section-skeleton";
import { ProfileWorkServer } from "@/components/resolve/profile/profile-work-server";
import { ProfileBootstrapProvider } from "@/components/resolve/profile/profile-bootstrap";
import { ProfileContributorIdentity } from "@/components/resolve/profile/profile-contributor-identity";
import { ProfileSettings } from "@/components/resolve/profile/profile-settings";
import { ProfileReturnBanner } from "@/components/resolve/profile/profile-return-banner";

/** Profile — identity & connections once; earnings live on Capital. */
export default function ProfilePage() {
  return (
    <ProfileShell>
      <Suspense fallback={null}>
        <ProfileReturnBanner />
      </Suspense>
      <ProfileBootstrapProvider>
        <ProfileSettings />

        <Suspense fallback={<ProfileSectionSkeleton label="Connected work" />}>
          <ProfileWorkServer />
        </Suspense>

        <ProfileContributorIdentity />
      </ProfileBootstrapProvider>
    </ProfileShell>
  );
}
