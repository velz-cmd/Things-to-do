"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  GitBranch,
  Globe2,
  Loader2,
  Music,
  Search,
  Tv,
} from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";
import { Panel } from "@/components/resolve/ui/panel";
import { Button } from "@/components/resolve/ui/button";
import { useResolveAccount } from "@/hooks/use-resolve-account";
import { useProfileBootstrap } from "@/components/resolve/profile/profile-bootstrap";
import { CONTRIBUTOR_IDENTITY_COPY } from "@/lib/receipt/copy";

type ArtistHit = {
  mbid: string;
  name: string;
  disambiguation?: string;
  type?: string;
  linked?: boolean;
};

type CommunityTab = "open_source" | "music" | "media" | "research";

const TAB_META: {
  id: CommunityTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "open_source", label: CONTRIBUTOR_IDENTITY_COPY.communities.open_source.label, icon: GitBranch },
  { id: "music", label: CONTRIBUTOR_IDENTITY_COPY.communities.music.label, icon: Music },
  { id: "media", label: CONTRIBUTOR_IDENTITY_COPY.communities.media.label, icon: Tv },
  { id: "research", label: CONTRIBUTOR_IDENTITY_COPY.communities.research.label, icon: Globe2 },
];

function CommunityIdentityPanel({
  tab,
  githubConnected,
  githubDisplay,
  jellyfinConnected,
  jellyfinDisplay,
  payoutReady,
}: {
  tab: CommunityTab;
  githubConnected: boolean;
  githubDisplay?: string;
  jellyfinConnected: boolean;
  jellyfinDisplay?: string;
  payoutReady: boolean;
}) {
  const music = CONTRIBUTOR_IDENTITY_COPY.communities.music;
  const oss = CONTRIBUTOR_IDENTITY_COPY.communities.open_source;
  const media = CONTRIBUTOR_IDENTITY_COPY.communities.media;
  const research = CONTRIBUTOR_IDENTITY_COPY.communities.research;

  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [linking, setLinking] = useState<string | null>(null);
  const [results, setResults] = useState<ArtistHit[]>([]);
  const [linkedArtist, setLinkedArtist] = useState<ArtistHit | null>(null);
  const [aliasName, setAliasName] = useState("");
  const [aliasLinking, setAliasLinking] = useState(false);
  const [aliases, setAliases] = useState<Array<{ id: string; artistName: string }>>([]);
  const account = useResolveAccount();
  const payoutWallet =
    account.appWalletAddress ?? account.walletAddress ?? account.externalWalletAddress;

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/registry/musicbrainz/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data.artists ?? []);
    } catch {
      toast.error(music.errorSearch);
    } finally {
      setSearching(false);
    }
  }, [music.errorSearch]);

  useEffect(() => {
    if (tab !== "music") return;
    const t = setTimeout(() => void search(query), 350);
    return () => clearTimeout(t);
  }, [query, search, tab]);

  useEffect(() => {
    if (tab !== "music" || !payoutWallet) return;
    void fetch("/api/registry/musicbrainz/alias", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : { aliases: [] }))
      .then((d) => setAliases(d.aliases ?? []))
      .catch(() => setAliases([]));
  }, [tab, payoutWallet]);

  async function linkAlias() {
    if (!payoutWallet) {
      toast.error(CONTRIBUTOR_IDENTITY_COPY.needAccount.body);
      return;
    }
    const name = aliasName.trim();
    if (name.length < 2) {
      toast.error("Enter the name as it appears in your scrobbles");
      return;
    }
    setAliasLinking(true);
    try {
      const res = await fetch("/api/registry/musicbrainz/alias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          artistName: name,
          musicbrainzId: linkedArtist?.mbid,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? music.aliasError);
      toast.success(music.aliasLinkedToast);
      setAliases((prev) => [{ id: data.alias.id, artistName: name }, ...prev]);
      setAliasName("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : music.aliasError);
    } finally {
      setAliasLinking(false);
    }
  }

  async function confirmArtist(artist: ArtistHit) {
    if (!payoutWallet) {
      toast.error(CONTRIBUTOR_IDENTITY_COPY.needAccount.body);
      return;
    }
    setLinking(artist.mbid);
    try {
      const res = await fetch("/api/registry/musicbrainz/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mbid: artist.mbid,
          artistName: artist.name,
          walletAddress: payoutWallet,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? music.errorLink);
      toast.success(music.linkedToast);
      setLinkedArtist({ ...artist, linked: true });
      setResults((prev) =>
        prev.map((a) => (a.mbid === artist.mbid ? { ...a, linked: true } : a)),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : music.errorLink);
    } finally {
      setLinking(null);
    }
  }

  const meta =
    tab === "open_source" ? oss
    : tab === "music" ? music
    : tab === "media" ? media
    : research;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
        <p className="text-xs leading-relaxed text-resolve-muted">
          <span className="font-medium text-white">When you earn: </span>
          {meta.whenYouEarn}
        </p>
        <p className="mt-2 text-xs leading-relaxed text-resolve-muted-dim">
          {meta.audienceNote}
        </p>
      </div>

      {tab === "open_source" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0a0f18] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">{oss.platform}</p>
            {githubConnected && githubDisplay ?
              <p className="mt-0.5 text-xs text-emerald-300">
                {oss.connectedLabel} {githubDisplay}
              </p>
            : <p className="mt-0.5 text-xs text-resolve-muted">{oss.connectHint}</p>}
          </div>
          {githubConnected ?
            <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {CONTRIBUTOR_IDENTITY_COPY.communities.music.confirmedButton}
            </span>
          : <Link
              href={oss.connectUrl}
              className="inline-flex h-8 items-center justify-center rounded-md bg-resolve-accent px-3 text-xs font-medium text-[#0a0f18] hover:opacity-90"
            >
              {oss.connectCta}
            </Link>
          }
        </div>
      )}

      {tab === "media" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-white/[0.08] bg-[#0a0f18] px-4 py-3">
          <div>
            <p className="text-sm font-medium text-white">{media.platform}</p>
            {jellyfinConnected && jellyfinDisplay ?
              <p className="mt-0.5 text-xs text-emerald-300">
                {media.connectedLabel}: {jellyfinDisplay}
              </p>
            : <p className="mt-0.5 text-xs text-resolve-muted">{media.connectHint}</p>}
          </div>
          {jellyfinConnected ?
            <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {CONTRIBUTOR_IDENTITY_COPY.communities.music.confirmedButton}
            </span>
          : <Link
              href={media.connectUrl}
              className="inline-flex h-8 items-center justify-center rounded-md bg-resolve-accent px-3 text-xs font-medium text-[#0a0f18] hover:opacity-90"
            >
              {media.connectCta}
            </Link>
          }
        </div>
      )}

      {tab === "research" && (
        <div className="rounded-xl border border-white/[0.08] bg-[#0a0f18] px-4 py-3">
          <p className="text-sm font-medium text-white">{research.platform}</p>
          <p className="mt-1 text-xs text-resolve-muted">{research.audienceNote}</p>
          <Link
            href={research.exploreUrl}
            className="mt-3 inline-block text-xs font-medium text-resolve-accent hover:underline"
          >
            {research.exploreCta} →
          </Link>
        </div>
      )}

      {tab === "music" && (
        <>
          {!payoutReady && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <p className="text-sm font-medium text-amber-100">
                {CONTRIBUTOR_IDENTITY_COPY.needAccount.title}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-100/80">
                {CONTRIBUTOR_IDENTITY_COPY.needAccount.body}
              </p>
              <Link
                href="/settings"
                className="mt-2 inline-block text-xs font-medium text-resolve-accent hover:underline"
              >
                {CONTRIBUTOR_IDENTITY_COPY.needAccount.cta} →
              </Link>
            </div>
          )}

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-resolve-muted" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={music.searchPlaceholder}
              className="w-full rounded-xl border border-white/[0.08] bg-[#0a0f18] py-3 pl-10 pr-4 text-sm text-white placeholder:text-resolve-muted-dim focus:border-resolve-accent/40 focus:outline-none"
            />
          </div>

          {linkedArtist && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3">
              <div className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                <div>
                  <p className="text-sm font-medium text-white">{linkedArtist.name}</p>
                  <p className="text-[11px] text-resolve-muted">{music.linkedBody}</p>
                </div>
              </div>
            </div>
          )}

          {searching && (
            <p className="flex items-center gap-2 text-xs text-resolve-muted">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {music.searching}
            </p>
          )}

          {!searching && results.length > 0 && (
            <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.06]">
              {results.map((artist) => (
                <li
                  key={artist.mbid}
                  className="flex items-start justify-between gap-3 px-4 py-3 hover:bg-white/[0.02]"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Music className="h-3.5 w-3.5 shrink-0 text-violet-400" />
                      <p className="truncate text-sm font-medium text-white">{artist.name}</p>
                      {artist.linked && (
                        <span className="shrink-0 rounded bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium uppercase text-emerald-300">
                          {music.confirmedButton}
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-resolve-muted">
                      {[artist.type, artist.disambiguation].filter(Boolean).join(" · ") ||
                        "Artist credit"}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant={artist.linked ? "secondary" : "primary"}
                    disabled={artist.linked || linking === artist.mbid || !payoutReady}
                    onClick={() => void confirmArtist(artist)}
                    className={clsx("shrink-0")}
                  >
                    {linking === artist.mbid ?
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : artist.linked ?
                      music.confirmedButton
                    : music.confirmButton}
                  </Button>
                </li>
              ))}
            </ul>
          )}

          {!searching && query.length >= 2 && results.length === 0 && (
            <p className="text-xs text-resolve-muted">{music.noResults}</p>
          )}

          <div className="rounded-xl border border-white/[0.08] bg-[#0a0f18]/60 px-4 py-4 space-y-3">
            <div>
              <p className="text-sm font-medium text-white">{music.aliasTitle}</p>
              <p className="mt-1 text-xs leading-relaxed text-resolve-muted">{music.aliasHint}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                value={aliasName}
                onChange={(e) => setAliasName(e.target.value)}
                placeholder={music.aliasPlaceholder}
                className="min-w-[200px] flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-resolve-muted-dim"
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={aliasLinking || !payoutReady}
                onClick={() => void linkAlias()}
              >
                {aliasLinking ?
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : music.aliasButton}
              </Button>
            </div>
            {aliases.length > 0 && (
              <ul className="flex flex-wrap gap-2">
                {aliases.map((a) => (
                  <li
                    key={a.id}
                    className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-200"
                  >
                    {a.artistName}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function ProfileContributorIdentity() {
  const [tab, setTab] = useState<CommunityTab>("music");
  const { data: bootstrap } = useProfileBootstrap();
  const account = useResolveAccount();
  const payoutReady = Boolean(
    account.appWalletAddress ?? account.walletAddress ?? account.externalWalletAddress,
  );

  const identities = bootstrap?.identities ?? [];
  const github = identities.find((i) => i.id === "github");
  const jellyfin = identities.find((i) => i.id === "jellyfin");

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-white">{CONTRIBUTOR_IDENTITY_COPY.title}</h2>
        <p className="mt-1 max-w-xl text-xs text-resolve-muted">{CONTRIBUTOR_IDENTITY_COPY.subtitle}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {TAB_META.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
              tab === id ?
                "border-resolve-accent/40 bg-resolve-accent/10 text-white"
              : "border-white/10 bg-white/[0.02] text-resolve-muted hover:text-white",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      <Panel variant="flat">
        <CommunityIdentityPanel
          tab={tab}
          githubConnected={Boolean(github?.connected)}
          githubDisplay={github?.displayValue}
          jellyfinConnected={Boolean(jellyfin?.connected)}
          jellyfinDisplay={jellyfin?.displayValue}
          payoutReady={payoutReady}
        />
      </Panel>
    </section>
  );
}

/** @deprecated use ProfileContributorIdentity */
export const ProfileMusicBrainzRegistry = ProfileContributorIdentity;
