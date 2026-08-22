import { describe, expect, it } from "vitest";
import {
  canonicalGithubRepoId,
  normalizeRepositoryLink,
  repositoryLinkMatchesGithub,
  normalizeDoi,
} from "@/lib/integrations/canonical-identity";

describe("canonicalGithubRepoId", () => {
  it("normalizes to a stable, case-insensitive host/owner/repo id", () => {
    expect(canonicalGithubRepoId("Foo", "React")).toBe("github.com/foo/react");
  });
});

describe("normalizeRepositoryLink", () => {
  it("strips git+ prefix, .git suffix, protocol, and trailing slash", () => {
    expect(normalizeRepositoryLink("git+https://github.com/foo/react.git")).toBe(
      "github.com/foo/react",
    );
    expect(normalizeRepositoryLink("https://github.com/foo/react/")).toBe(
      "github.com/foo/react",
    );
  });

  it("returns null for empty or missing input", () => {
    expect(normalizeRepositoryLink(undefined)).toBeNull();
    expect(normalizeRepositoryLink(null)).toBeNull();
    expect(normalizeRepositoryLink("")).toBeNull();
  });
});

describe("repositoryLinkMatchesGithub - identity before metrics", () => {
  it("matches only the exact repository, never a same-owner sibling repo", () => {
    // foo/react vs foo/reactjs - a real near-miss class, not hypothetical.
    expect(
      repositoryLinkMatchesGithub("https://github.com/foo/reactjs", "foo", "react"),
    ).toBe(false);
    expect(
      repositoryLinkMatchesGithub("https://github.com/foo/react", "foo", "react"),
    ).toBe(true);
  });

  it("rejects an unrelated repository that would otherwise rank highly in a fuzzy search", () => {
    // This is the exact shape of the live navidrome/react-admin bug.
    expect(
      repositoryLinkMatchesGithub(
        "git+https://github.com/marmelab/react-admin.git",
        "navidrome",
        "navidrome",
      ),
    ).toBe(false);
  });

  it("rejects a similarly-named but different-owner repository", () => {
    expect(
      repositoryLinkMatchesGithub(
        "https://github.com/someone-else/navidrome",
        "navidrome",
        "navidrome",
      ),
    ).toBe(false);
  });

  it("rejects a renamed/moved repository link that no longer matches the canonical owner/repo", () => {
    // A repo that moved from old-owner/old-name must not silently keep
    // attaching metrics to the new canonical identity unless that new
    // identity is what's actually being searched for.
    expect(
      repositoryLinkMatchesGithub(
        "https://github.com/old-owner/old-name",
        "new-owner",
        "new-name",
      ),
    ).toBe(false);
  });

  it("is case-insensitive but still exact", () => {
    expect(
      repositoryLinkMatchesGithub("https://GitHub.com/Foo/React", "foo", "react"),
    ).toBe(true);
  });
});

describe("normalizeDoi", () => {
  it("strips the doi.org prefix and lowercases, so Crossref and OpenAlex agree on identity", () => {
    expect(normalizeDoi("https://doi.org/10.1234/ABC.567")).toBe("10.1234/abc.567");
    expect(normalizeDoi("10.1234/ABC.567")).toBe("10.1234/abc.567");
  });
});
