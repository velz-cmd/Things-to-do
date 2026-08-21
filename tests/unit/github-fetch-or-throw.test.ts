import { describe, expect, it, vi, beforeEach } from "vitest";

const fetchMock = vi.fn();
vi.stubGlobal("fetch", fetchMock);

import { githubFetchOrThrow, GithubUpstreamError } from "@/lib/github/client";

describe("githubFetchOrThrow", () => {
  beforeEach(() => {
    fetchMock.mockReset();
  });

  it("returns null only for a genuine 404 (repository does not exist)", async () => {
    fetchMock.mockResolvedValueOnce({ status: 404, ok: false });
    const result = await githubFetchOrThrow("https://api.github.com/repos/x/y");
    expect(result).toBeNull();
  });

  it("throws GithubUpstreamError on a 401 (bad/expired GITHUB_TOKEN) instead of returning null", async () => {
    fetchMock.mockResolvedValueOnce({ status: 401, ok: false });
    await expect(githubFetchOrThrow("https://api.github.com/repos/x/y")).rejects.toThrow(
      GithubUpstreamError,
    );
  });

  it("throws GithubUpstreamError on a 403 (rate limited) instead of returning null", async () => {
    fetchMock.mockResolvedValueOnce({ status: 403, ok: false });
    await expect(githubFetchOrThrow("https://api.github.com/repos/x/y")).rejects.toThrow(
      GithubUpstreamError,
    );
  });

  it("returns the parsed body on success", async () => {
    fetchMock.mockResolvedValueOnce({
      status: 200,
      ok: true,
      json: async () => ({ full_name: "x/y" }),
    });
    const result = await githubFetchOrThrow<{ full_name: string }>(
      "https://api.github.com/repos/x/y",
    );
    expect(result).toEqual({ full_name: "x/y" });
  });
});
