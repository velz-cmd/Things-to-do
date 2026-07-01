import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { buildUserEligibleWork } from "@/lib/earn/user-eligible-work";
import { ProfileWorkView } from "@/components/resolve/profile/profile-work-view";

export async function ProfileWorkServer() {
  const user = await getSessionUser();
  if (!user) {
    return <ProfileWorkView signedIn={false} streams={[]} />;
  }

  try {
    const profile = await ensureProfileForUser(user);
    const streams = await buildUserEligibleWork({ userId: user.id, profile });
    return <ProfileWorkView signedIn streams={streams} />;
  } catch {
    return <ProfileWorkView signedIn streams={[]} degraded />;
  }
}
