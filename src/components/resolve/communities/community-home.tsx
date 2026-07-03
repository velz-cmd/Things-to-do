"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Music2 } from "lucide-react";
import { toast } from "sonner";
import { ProductPage } from "@/components/resolve/layout/product-page";
import { InstallResolveCard } from "@/components/resolve/communities/install-resolve-card";
import { CommunityIntentBanner } from "@/components/resolve/communities/community-intent-banner";
import { CommunityConsoleSkeleton } from "@/components/resolve/communities/communities-skeletons";
import { CommunityConsole } from "@/components/resolve/communities/community-console";
import { CommunityAdvancedPanel } from "@/components/resolve/communities/community-advanced-panel";
import {
  CommunityFundSheetHost,
  useCommunityOperationsHandlers,
} from "@/components/resolve/communities/community-operations";
import { CommunitySensorPanel } from "@/components/resolve/communities/community-sensor-panel";
import { useUserConnections } from "@/components/resolve/profile/user-connections-provider";
import { useCommunitySurfaceQuery } from "@/lib/query/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query/keys";
import { loadPersistedDiscoverRole } from "@/lib/discover/discover-role-persist";
import type { DiscoverRole } from "@/lib/discover/role-filters";
import { getCommunityBySlug } from "@/lib/communities/catalog";
import {
  COMMUNITY_INTENT_ANCHOR,
  type CommunityIntent,
} from "@/lib/communities/community-nav";
import { defaultProgramTemplateForCommunity } from "@/lib/discover/community-strip-actions";

export function CommunityHome({ slug }: { slug: string }) {
  const catalog = getCommunityBySlug(slug);
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const pageIntent = searchParams.get("intent");
  const tab = searchParams.get("tab") === "advanced" ? "advanced" : "console";
  const [discoverRole, setDiscoverRole] = useState<DiscoverRole | null>(null);
  const { state: connections } = useUserConnections();
  const [deploying, setDeploying] = useState<string | null>(null);
  const ops = useCommunityOperationsHandlers(slug);

  const {
    data: surface,
    isLoading: loading,
    refetch,
  } = useCommunitySurfaceQuery(slug, { pollWhenInstalled: true });

  useEffect(() => {
    setDiscoverRole(loadPersistedDiscoverRole());
  }, []);

  useEffect(() => {
    if (!pageIntent || loading) return;
    const anchor = COMMUNITY_INTENT_ANCHOR[pageIntent as CommunityIntent];
    if (!anchor) return;
    const timer = window.setTimeout(() => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [pageIntent, loading, surface]);

  const refresh = useCallback(async () => {
    await refetch();
  }, [refetch]);

  async function deploy(programId: string) {
    setDeploying(programId);
    try {
      const res = await fetch(`/api/communities/${slug}/programs/${programId}/deploy`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? data.error ?? "Deploy failed");
      toast.success(data.message);
      if (data.community) {
        queryClient.setQueryData(queryKeys.communitySurface(slug), data.community);
      } else await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Deploy failed");
    } finally {
      setDeploying(null);
    }
  }

  async function handleCreateProgram() {
    const templateId = defaultProgramTemplateForCommunity(slug);
    await ops.createProgram(slug, templateId);
  }

  if (!catalog) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-resolve-muted">Community not found</p>
      </div>
    );
  }

  const installed = surface?.installed ?? false;
  const surfaceLoading = loading && !surface;

  const consoleHref = `/communities/${slug}`;
  const advancedHref = `/communities/${slug}?tab=advanced`;

  return (
    <ProductPage
      icon={Music2}
      title={catalog.name}
      description={catalog.tagline}
      workflows={[
        { label: "Console", href: consoleHref, active: tab === "console" },
        { label: "Advanced", href: advancedHref, active: tab === "advanced" },
        { label: "Discover", href: "/discover" },
        { label: "Capital", href: "/capital" },
      ]}
      width="wide"
      accent="emerald"
      actions={
        !installed ? (
          <InstallResolveCard community={catalog} installed={false} compact />
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" />
            RESOLVE connected
          </span>
        )
      }
    >
      <CommunityIntentBanner
        intent={pageIntent}
        role={discoverRole}
        catalog={catalog}
        installed={installed}
      />

      {!installed ? (
        <div className="max-w-lg space-y-6">
          {surfaceLoading ? (
            <CommunityConsoleSkeleton />
          ) : (
            <>
              <InstallResolveCard community={catalog} onInstalled={() => void refresh()} />
              <CommunitySensorPanel slug={slug} installed={false} />
              <p className="text-xs text-resolve-muted">
                After install,{" "}
                <Link href={`/communities/${slug}?intent=install`} className="text-resolve-accent hover:underline">
                  open the console
                </Link>{" "}
                to create programs and operate payouts.
              </p>
            </>
          )}
        </div>
      ) : surfaceLoading || !surface ? (
        <CommunityConsoleSkeleton />
      ) : tab === "advanced" ? (
        <CommunityAdvancedPanel slug={slug} surface={surface} onRefresh={() => void refresh()} />
      ) : (
        <CommunityConsole
          slug={slug}
          catalog={catalog}
          surface={surface}
          connections={connections}
          busy={ops.busy}
          deploying={deploying}
          onDeploy={(id) => void deploy(id)}
          onFund={(programId) => ops.fundProgram(programId, slug)}
          onCreateProgram={handleCreateProgram}
          onRefresh={() => void refresh()}
        />
      )}

      <CommunityFundSheetHost slug={slug} ops={ops} />
    </ProductPage>
  );
}
