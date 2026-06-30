import { NextResponse } from "next/server";
import { COMMUNITY_CATALOG } from "@/lib/communities/catalog";
import { listFundableOpportunities } from "@/lib/capital/funder-discovery";
import { scanAllOpportunities } from "@/lib/github/opportunities";
import type { DiscoverSearchResult } from "@/lib/discover/types";

function repoPath(owner: string, repo: string) {
  return `/e/repo/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim().toLowerCase() ?? "";
  if (!q) {
    return NextResponse.json({ ok: true, results: [] as DiscoverSearchResult[] });
  }

  const skipGithub = process.env.CI === "true";
  const [oss, fundable] = await Promise.all([
    skipGithub ? Promise.resolve([]) : scanAllOpportunities().catch(() => []),
    listFundableOpportunities(24),
  ]);

  const results: DiscoverSearchResult[] = [];

  if (q.includes("/")) {
    const [owner, repo] = q.split("/");
    if (owner && repo) {
      results.push({
        id: `repo-${owner}/${repo}`,
        kind: "repository",
        label: `${owner}/${repo}`,
        subtitle: "Open repository entity surface",
        entityPath: repoPath(owner, repo),
        communitySlug: "react",
        actions: [
          { id: "open", label: "Open entity", kind: "open", entityPath: repoPath(owner, repo) },
          { id: "fund", label: "Fund gap", kind: "fund", href: "#opportunities" },
          {
            id: "install",
            label: "Install OSS",
            kind: "install",
            communitySlug: "react",
          },
          {
            id: "bounty",
            label: "Create docs bounty",
            kind: "create_program",
            communitySlug: "react",
            templateId: "docs-bounty",
          },
        ],
      });
    }
  }

  for (const c of COMMUNITY_CATALOG) {
    if (
      c.name.toLowerCase().includes(q) ||
      c.slug.includes(q) ||
      c.keywords.some((k) => k.includes(q)) ||
      c.tagline.toLowerCase().includes(q)
    ) {
      results.push({
        id: `community-${c.slug}`,
        kind: "community",
        label: c.name,
        subtitle: c.tagline,
        communitySlug: c.slug,
        actions: [
          { id: "install", label: "Install", kind: "install", communitySlug: c.slug },
          {
            id: "open",
            label: "Open",
            kind: "open",
            href: `/communities/${c.slug}`,
          },
          {
            id: "program",
            label: "Create program",
            kind: "create_program",
            communitySlug: c.slug,
          },
          {
            id: "sensor",
            label: "Connect sensor",
            kind: "connect_sensor",
            href: `/communities/${c.slug}`,
          },
        ],
      });
    }
  }

  for (const o of fundable) {
    if (
      o.programName.toLowerCase().includes(q) ||
      o.communityName.toLowerCase().includes(q) ||
      o.communitySlug.includes(q)
    ) {
      results.push({
        id: `program-${o.programId}`,
        kind: "program",
        label: o.programName,
        subtitle: `${o.communityName} · $${o.fundingGapUsd.toFixed(0)} gap`,
        communitySlug: o.communitySlug,
        programId: o.programId,
        actions: [
          { id: "fund", label: "Fund", kind: "fund", programId: o.programId },
          {
            id: "open",
            label: "Open community",
            kind: "open",
            href: `/communities/${o.communitySlug}`,
          },
        ],
      });
    }
  }

  for (const o of oss) {
    if (o.fullName.toLowerCase().includes(q) || o.headline.toLowerCase().includes(q)) {
      results.push({
        id: `oss-${o.fullName}`,
        kind: "repository",
        label: o.fullName,
        subtitle: o.headline,
        entityPath: repoPath(o.owner, o.repo),
        actions: [
          { id: "open", label: "Open", kind: "open", entityPath: repoPath(o.owner, o.repo) },
          { id: "fund", label: "Fund gap", kind: "fund", href: "#opportunities" },
          {
            id: "analyze",
            label: "Run analysis",
            kind: "analyze",
            entityPath: repoPath(o.owner, o.repo),
          },
        ],
      });
    }
  }

  const domainHints: Record<string, { label: string; href: string }> = {
    music: { label: "Music radar", href: "#radar-music" },
    artist: { label: "Creator radar", href: "#radar-music" },
    oss: { label: "OSS radar", href: "#radar-oss" },
    github: { label: "OSS radar", href: "#radar-oss" },
    research: { label: "Research radar", href: "#radar-research" },
    dao: { label: "DAO radar", href: "#radar-dao" },
    claim: { label: "Claim earnings", href: "/claim" },
    fund: { label: "Fulfillment queue", href: "#opportunities" },
  };

  for (const [key, hint] of Object.entries(domainHints)) {
    if (q.includes(key)) {
      results.push({
        id: `domain-${key}`,
        kind: "domain",
        label: hint.label,
        subtitle: `Jump to ${key} actions in Discover`,
        actions: [{ id: "jump", label: "Go", kind: "open", href: hint.href }],
      });
    }
  }

  const seen = new Set<string>();
  const deduped = results.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  return NextResponse.json({
    ok: true,
    results: deduped.slice(0, 12),
  });
}
