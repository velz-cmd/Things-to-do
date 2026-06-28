"use client";

import { Suspense } from "react";
import { User } from "lucide-react";
import { ProductPage } from "@/components/resolve/layout/product-page";
import { ProfileSettings } from "@/components/resolve/profile/profile-settings";
import { ProfileInstalledCommunities } from "@/components/resolve/profile/profile-installed-communities";

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
        <div className="space-y-10">
          <ProfileInstalledCommunities />
          <ProfileSettings />
        </div>
      </Suspense>
    </ProductPage>
  );
}
