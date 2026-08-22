import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/integrations/config", () => ({
  env: vi.fn(() => "test-api-key"),
  INTEGRATIONS: { librariesIo: () => true },
}));

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { fetchPackageDependentsForRepo } from "@/lib/integrations/libraries-io";

function searchResponse(results: Array<{ platform: string; name: string; repository_url?: string; dependents_count?: number }>) {
  return { ok: true, json: async () => ({ results }) };
}

describe("fetchPackageDependentsForRepo", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("never matches a repository_url that merely contains the search text as a substring", async () => {
    fetchMock.mockResolvedValueOnce(
      searchResponse([
        {
          platform: "NPM",
          name: "unrelated-react-fork",
          repository_url: "https://github.com/someone-else/foo-reactjs",
          dependents_count: 9999,
        },
      ]),
    );
    const result = await fetchPackageDependentsForRepo("foo", "react");
    expect(result).toBeNull();
  });

  it("matches only an exact owner/repo repository_url", async () => {
    fetchMock.mockResolvedValueOnce(
      searchResponse([
        {
          platform: "NPM",
          name: "unrelated",
          repository_url: "https://github.com/someone/else",
          dependents_count: 500,
        },
        {
          platform: "Go",
          name: "real-package",
          repository_url: "git+https://github.com/expressjs/express.git",
          dependents_count: 42,
        },
      ]),
    );
    const result = await fetchPackageDependentsForRepo("expressjs", "express");
    expect(result).toEqual({ platform: "Go", name: "real-package", dependents: 42 });
  });

  it("returns null when the exact match has no dependents", async () => {
    fetchMock.mockResolvedValueOnce(
      searchResponse([
        {
          platform: "NPM",
          name: "real-package",
          repository_url: "https://github.com/expressjs/express",
          dependents_count: 0,
        },
      ]),
    );
    const result = await fetchPackageDependentsForRepo("expressjs", "express");
    expect(result).toBeNull();
  });
});
