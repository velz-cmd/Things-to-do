import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchAdvisoriesForNpmPackage } from "@/lib/integrations/github-advisories";

/**
 * Phase 2: GitHub Security Advisories, filtered to exactly one confirmed
 * npm package name - never a fuzzy or substring match, matching the same
 * identity discipline already proven for npm/Libraries.io in
 * canonical-identity.test.ts.
 */
describe("fetchAdvisoriesForNpmPackage", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => fetchSpy.mockRestore());

  it("returns an empty list when the source request fails", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false } as Response);
    const result = await fetchAdvisoriesForNpmPackage("widgets");
    expect(result).toEqual([]);
  });

  it("only accepts an advisory whose vulnerability entry names this exact npm package", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          ghsa_id: "GHSA-real-match",
          cve_id: "CVE-2026-0001",
          summary: "Prototype pollution",
          severity: "high",
          published_at: "2026-08-01T00:00:00.000Z",
          html_url: "https://github.com/advisories/GHSA-real-match",
          vulnerabilities: [
            { package: { ecosystem: "npm", name: "widgets" }, patched_versions: ">=2.0.1" },
          ],
        },
        {
          ghsa_id: "GHSA-wrong-package",
          cve_id: null,
          summary: "Unrelated package, similar name",
          severity: "low",
          published_at: "2026-08-01T00:00:00.000Z",
          html_url: "https://github.com/advisories/GHSA-wrong-package",
          vulnerabilities: [
            { package: { ecosystem: "npm", name: "widgets-cli" }, patched_versions: ">=1.0.1" },
          ],
        },
      ],
    } as Response);

    const result = await fetchAdvisoriesForNpmPackage("widgets");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      ghsaId: "GHSA-real-match",
      cveId: "CVE-2026-0001",
      patchedVersions: ">=2.0.1",
    });
  });

  it("never matches a different ecosystem carrying the same package name", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => [
        {
          ghsa_id: "GHSA-pip-widgets",
          cve_id: null,
          summary: "Unrelated pip package",
          severity: "moderate",
          published_at: "2026-08-01T00:00:00.000Z",
          html_url: "https://github.com/advisories/GHSA-pip-widgets",
          vulnerabilities: [
            { package: { ecosystem: "pip", name: "widgets" }, patched_versions: ">=3.0.0" },
          ],
        },
      ],
    } as Response);

    const result = await fetchAdvisoriesForNpmPackage("widgets");
    expect(result).toEqual([]);
  });
});
