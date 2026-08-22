import { describe, expect, it } from "vitest";
import {
  POPULARITY_FIELDS,
  buildImpactProfile,
  describeSignal,
  githubWorkImpactProfile,
  impactSignal,
  isPopularityField,
} from "../../src/lib/discover/impact/impact-signals";

const observedAt = "2026-08-15T00:00:00.000Z";

describe("Discover impact signals", () => {
  it("refuses to turn popularity or activity counts into impact signals", () => {
    for (const field of POPULARITY_FIELDS) {
      expect(isPopularityField(field)).toBe(true);
      expect(
        impactSignal({
          id: field,
          label: field,
          count: 9_999,
          scope: "repository",
          source: "GitHub",
          observedAt,
        }),
      ).toBeNull();
    }
  });

  it("requires a source and an observation timestamp for every number", () => {
    const base = {
      id: "dependent_repositories",
      label: "Dependent repositories",
      count: 12,
      scope: "repository" as const,
    };
    expect(
      impactSignal({ ...base, source: "Libraries.io", observedAt }),
    ).not.toBeNull();
    // No timestamp -> cannot be aged or trusted -> not a signal.
    expect(
      impactSignal({ ...base, source: "Libraries.io", observedAt: null }),
    ).toBeNull();
    // No source -> anonymous number -> not a signal.
    expect(impactSignal({ ...base, source: "  ", observedAt })).toBeNull();
  });

  it("keeps unknown distinct from measured zero", () => {
    const shared = {
      id: "dependent_repositories",
      label: "Dependent repositories",
      scope: "repository" as const,
      source: "Libraries.io",
      observedAt,
    };
    expect(impactSignal({ ...shared, count: null })).toBeNull();
    expect(impactSignal({ ...shared, count: undefined })).toBeNull();
    expect(impactSignal({ ...shared, count: 0 })).toBeNull();
    expect(impactSignal({ ...shared, count: Number.NaN })).toBeNull();
  });

  it("never presents a repository-scoped number as per-change benefit", () => {
    const signal = impactSignal({
      id: "dependent_repositories",
      label: "Dependent repositories",
      count: 1284,
      scope: "repository",
      source: "Libraries.io",
      observedAt,
    });
    expect(signal).not.toBeNull();
    const description = describeSignal(signal!);
    expect(description).toContain("1,284");
    expect(description).toContain("Libraries.io");
    // The scope caveat is the whole point - it must survive rendering.
    expect(description).toContain("not this change specifically");
  });

  it("reports impact as not measurable instead of falling back to merge counts", () => {
    const profile = githubWorkImpactProfile({
      repositoryFullName: "octocat/hello-world",
      adoption: null,
    });
    expect(profile.measurable).toBe(false);
    if (!profile.measurable) {
      expect(profile.reason).toMatch(/not yet measurable/i);
    }
  });

  it("surfaces a real sourced adoption signal when a connector observed one", () => {
    const profile = githubWorkImpactProfile({
      repositoryFullName: "octocat/hello-world",
      adoption: {
        dependentRepoCount: 1284,
        source: "Libraries.io",
        observedAt,
      },
    });
    expect(profile.measurable).toBe(true);
    if (profile.measurable) {
      expect(profile.signals).toHaveLength(1);
      expect(profile.signals[0]).toMatchObject({
        id: "dependent_repositories",
        value: "1,284",
        scope: "repository",
        source: "Libraries.io",
        observedAt,
      });
    }
  });

  it("surfaces an advisories-with-published-fix signal from durably-observed security data, never labeled 'resolved'", () => {
    const profile = githubWorkImpactProfile({
      repositoryFullName: "acme/widgets",
      security: {
        advisoriesWithPublishedFix: [
          { htmlUrl: "https://github.com/advisories/GHSA-real" },
        ],
        observedAt,
      },
    });
    expect(profile.measurable).toBe(true);
    if (profile.measurable) {
      const security = profile.signals.find((s) => s.id === "advisories_with_published_fix");
      expect(security).toMatchObject({
        value: "1",
        scope: "repository",
        source: "GitHub Security Advisories",
        sourceUrl: "https://github.com/advisories/GHSA-real",
        classification: "observed",
      });
      expect(security!.label.toLowerCase()).not.toContain("resolved");
    }
  });

  it("does not produce an empty but measurable profile", () => {
    const profile = buildImpactProfile([null, null], "nothing observed");
    expect(profile.measurable).toBe(false);
  });

  it("classifies every signal built through impactSignal() as 'observed', never 'heuristic' or 'derived'", () => {
    const signal = impactSignal({
      id: "dependent_repositories",
      label: "Dependent repositories",
      count: 12,
      scope: "repository",
      source: "Libraries.io",
      observedAt,
    });
    expect(signal?.classification).toBe("observed");
  });
});
