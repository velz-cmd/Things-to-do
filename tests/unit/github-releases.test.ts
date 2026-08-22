import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchReleasesForRepo } from "@/lib/integrations/github-releases";

describe("fetchReleasesForRepo", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => fetchSpy.mockRestore());

  it("returns an empty list when the source request fails", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false } as Response);
    const result = await fetchReleasesForRepo("acme", "widgets");
    expect(result).toEqual([]);
  });

  it("excludes draft releases unconditionally", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 1,
          tag_name: "v2.0.0",
          name: "v2.0.0",
          published_at: "2026-08-01T00:00:00.000Z",
          html_url: "https://github.com/acme/widgets/releases/tag/v2.0.0",
          author: { login: "maintainer" },
          draft: false,
          prerelease: false,
        },
        {
          id: 2,
          tag_name: "v2.1.0-draft",
          name: "v2.1.0 draft",
          published_at: null,
          html_url: "https://github.com/acme/widgets/releases/tag/v2.1.0-draft",
          author: { login: "maintainer" },
          draft: true,
          prerelease: false,
        },
      ],
    } as Response);

    const result = await fetchReleasesForRepo("acme", "widgets");
    expect(result).toHaveLength(1);
    expect(result[0].tagName).toBe("v2.0.0");
  });

  it("preserves prerelease semantics rather than treating it as a stable release", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 3,
          tag_name: "v3.0.0-rc.1",
          name: "v3.0.0-rc.1",
          published_at: "2026-08-01T00:00:00.000Z",
          html_url: "https://github.com/acme/widgets/releases/tag/v3.0.0-rc.1",
          author: { login: "maintainer" },
          draft: false,
          prerelease: true,
        },
      ],
    } as Response);

    const result = await fetchReleasesForRepo("acme", "widgets");
    expect(result[0].prerelease).toBe(true);
  });

  it("preserves release identity (id, tag, author, url) for dedup and provenance", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          id: 42,
          tag_name: "v1.0.0",
          name: "First stable",
          published_at: "2026-08-01T00:00:00.000Z",
          html_url: "https://github.com/acme/widgets/releases/tag/v1.0.0",
          author: { login: "maintainer" },
          draft: false,
          prerelease: false,
        },
      ],
    } as Response);

    const result = await fetchReleasesForRepo("acme", "widgets");
    expect(result[0]).toEqual({
      id: 42,
      tagName: "v1.0.0",
      name: "First stable",
      publishedAt: "2026-08-01T00:00:00.000Z",
      htmlUrl: "https://github.com/acme/widgets/releases/tag/v1.0.0",
      author: "maintainer",
      draft: false,
      prerelease: false,
    });
  });
});
