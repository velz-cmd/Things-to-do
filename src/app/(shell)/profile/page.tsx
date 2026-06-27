"use client";

import { User } from "lucide-react";
import { ProductPage } from "@/components/resolve/layout/product-page";
import { ProfileSettings } from "@/components/resolve/profile/profile-settings";

export default function ProfilePage() {
  return (
    <ProductPage
      icon={User}
      title="Who am I in this ecosystem?"
      description="Connect where each community lives — GitHub for code, MusicBrainz for creative work, Arc for settlement. One identity layer for funding open communities."
      workflows={[
        { label: "Open source" },
        { label: "Music" },
        { label: "Settlement" },
      ]}
      width="narrow"
      accent="blue"
    >
      <ProfileSettings />
    </ProductPage>
  );
}
