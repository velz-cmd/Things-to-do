import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { getProfileEarningsSummaryCached } from "@/lib/earn/earnings-snapshot";
import { ProfileEarningsView } from "@/components/resolve/profile/profile-earnings-view";

export async function ProfileEarningsServer() {
  const user = await getSessionUser();
  if (!user) {
    return <ProfileEarningsView signedIn={false} data={null} />;
  }

  const profile = await ensureProfileForUser(user);
  const earnings = await getProfileEarningsSummaryCached({
    userId: user.id,
    profile,
    maxAgeMs: 5 * 60_000,
  }).catch(() => null);

  return <ProfileEarningsView signedIn data={earnings} />;
}
