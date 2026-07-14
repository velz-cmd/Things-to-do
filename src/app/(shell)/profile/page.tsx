import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileControlPlane, ProfileControlPlaneSkeleton } from "@/components/resolve/profile/profile-control-plane";
import { ProfileReturnBanner } from "@/components/resolve/profile/profile-return-banner";
import { getSessionUser } from "@/lib/auth/session";
import { loadProfileControlPlaneBootstrap } from "@/lib/profile/control-plane-bootstrap";

export const metadata: Metadata = { title: "Profile — RESOLVE", description: "Identity, source, access, and payout controls." };

export default async function ProfilePage() {
  const user = await getSessionUser();
  const initialData = user ? await loadProfileControlPlaneBootstrap(user).catch(() => null) : null;
  return <><Suspense fallback={null}><ProfileReturnBanner /></Suspense><Suspense fallback={<ProfileControlPlaneSkeleton />}><ProfileControlPlane initialData={initialData} /></Suspense></>;
}
