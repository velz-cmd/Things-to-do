import { describe, expect, it, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { findNpmPackagesForRepo } from "@/lib/integrations/npm-registry";

function searchResponse(objects: Array<{ name: string; repository?: string }>) {
  return {
    ok: true,
    json: async () => ({
      objects: objects.map((o) => ({
        package: {
          name: o.name,
          links: o.repository ? { repository: o.repository } : undefined,
        },
      })),
    }),
  };
}

describe("findNpmPackagesForRepo", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("never attributes an unrelated, higher-ranked package to this repo", async () => {
    // Reproduces a real observed case: npm's fuzzy search ranked
    // "react-admin" (an unrelated package with far more downloads) above
    // "navidrome-music-player", the only package that actually declares
    // navidrome/navidrome... except it doesn't either - it declares a
    // *different* navidrome repo (react-music-player). Neither should match.
    fetchMock.mockResolvedValueOnce(
      searchResponse([
        { name: "navidrome-music-player", repository: "git+https://github.com/navidrome/react-music-player.git" },
        { name: "react-admin", repository: "git+https://github.com/marmelab/react-admin.git" },
      ]),
    );
    const names = await findNpmPackagesForRepo("navidrome", "navidrome");
    expect(names).toEqual([]);
  });

  it("matches a package whose repository link exactly resolves to owner/repo", async () => {
    fetchMock.mockResolvedValueOnce(
      searchResponse([
        { name: "express", repository: "git+https://github.com/expressjs/express.git" },
        { name: "unrelated-thing", repository: "git+https://github.com/someone/else.git" },
      ]),
    );
    const names = await findNpmPackagesForRepo("expressjs", "express");
    expect(names).toEqual(["express"]);
  });

  it("drops candidates with no repository link at all", async () => {
    fetchMock.mockResolvedValueOnce(searchResponse([{ name: "no-repo-field" }]));
    const names = await findNpmPackagesForRepo("someone", "somewhere");
    expect(names).toEqual([]);
  });
});
