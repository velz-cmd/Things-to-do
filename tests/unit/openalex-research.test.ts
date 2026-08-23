import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchOpenAlexWorks, fetchCitingWorksForOpenAlexId } from "@/lib/integrations/openalex";

describe("searchOpenAlexWorks", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => fetchSpy.mockRestore());

  it("returns an empty list for an empty query", async () => {
    expect(await searchOpenAlexWorks("  ")).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("parses real author identity including OpenAlex author IDs", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            id: "https://openalex.org/W1",
            title: "A paper",
            cited_by_count: 5,
            authorships: [
              { author: { id: "https://openalex.org/A1", display_name: "Jane Smith" } },
              { author: { display_name: "No ID Author" } },
            ],
          },
        ],
      }),
    } as Response);
    const [work] = await searchOpenAlexWorks("x");
    expect(work.authors).toEqual([
      { displayName: "Jane Smith", openAlexAuthorId: "https://openalex.org/A1" },
      { displayName: "No ID Author", openAlexAuthorId: undefined },
    ]);
    expect(work.authorNames).toEqual(["Jane Smith", "No ID Author"]);
  });

  it("preserves referenced work IDs (this work's own outgoing references), bounded", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            id: "https://openalex.org/W1",
            title: "A paper",
            cited_by_count: 0,
            referenced_works: Array.from({ length: 40 }, (_, i) => `https://openalex.org/W${i}`),
          },
        ],
      }),
    } as Response);
    const [work] = await searchOpenAlexWorks("x");
    expect(work.referencedWorkIds).toHaveLength(25);
  });

  it("preserves source/journal display name when present", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [
          {
            id: "https://openalex.org/W1",
            title: "A paper",
            cited_by_count: 0,
            primary_location: { source: { display_name: "Journal of Examples" } },
          },
        ],
      }),
    } as Response);
    const [work] = await searchOpenAlexWorks("x");
    expect(work.sourceDisplayName).toBe("Journal of Examples");
  });

  it("returns an empty list on provider failure", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false } as Response);
    expect(await searchOpenAlexWorks("x")).toEqual([]);
  });
});

describe("fetchCitingWorksForOpenAlexId", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => fetchSpy.mockRestore());

  it("returns an empty list for an empty id", async () => {
    expect(await fetchCitingWorksForOpenAlexId("")).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("fetches real citing works via the cites: filter, never inferred from title similarity", async () => {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        results: [{ id: "https://openalex.org/W2", title: "Citing work", publication_year: 2025 }],
      }),
    } as Response);
    const result = await fetchCitingWorksForOpenAlexId("https://openalex.org/W1");
    expect(result).toEqual([
      { openAlexId: "https://openalex.org/W2", title: "Citing work", publicationYear: 2025 },
    ]);
    const calledUrl = fetchSpy.mock.calls[0][0] as string;
    expect(calledUrl).toContain("cites%3AW1");
  });

  it("returns an empty list on provider failure rather than throwing", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false } as Response);
    expect(await fetchCitingWorksForOpenAlexId("https://openalex.org/W1")).toEqual([]);
  });
});
