import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";
import { InstallResolveCard } from "@/components/resolve/communities/install-resolve-card";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { listCommunitySummaries } from "@/lib/communities/surface";

export async function ProfileInstallationsServer() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <section className="space-y-4">
        <h2 className="text-sm font-semibold text-white">RESOLVE installations</h2>
        <p className="text-xs text-resolve-muted">Sign in to see installed communities.</p>
      </section>
    );
  }

  await ensureProfileForUser(user);
  const communities = await listCommunitySummaries(user.id);
  const installed = communities.filter((c) => c.installed);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-white">RESOLVE installations</h2>
          <p className="mt-0.5 text-xs text-resolve-muted">
            Communities where doctrine and settlement are attached
          </p>
        </div>
        <Link
          href="/communities"
          className="inline-flex items-center gap-1 text-xs font-medium text-resolve-accent hover:underline"
        >
          Communities hub
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      </div>

      <div className="space-y-3">
        {installed.length > 0 ? (
          installed.map((c) => {
            const meta = COMMUNITY_CATALOG.find((f) => f.slug === c.slug);
            if (!meta) return null;
            return <InstallResolveCard key={c.slug} community={meta} installed compact />;
          })
        ) : (
          <>
            <p className="text-xs text-resolve-muted-dim">
              Explore communities in Discover — featured programs attach in one click.
            </p>
            {COMMUNITY_CATALOG.filter((c) => c.featured)
              .slice(0, 2)
              .map((c) => (
                <InstallResolveCard key={c.slug} community={c} installed={false} compact />
              ))}
          </>
        )}
      </div>
    </section>
  );
}
