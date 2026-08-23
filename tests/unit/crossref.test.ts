import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { searchCrossref } from "@/lib/integrations/crossref";

describe("searchCrossref", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => fetchSpy.mockRestore());

  function mockResponse(items: unknown[]) {
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: { items } }),
    } as Response);
  }

  it("returns an empty list for an empty query", async () => {
    expect(await searchCrossref("   ")).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("preserves day-precision dates without fabricating time", async () => {
    mockResponse([
      { DOI: "10.1/a", title: ["A"], URL: "https://doi.org/10.1/a", published: { "date-parts": [[2024, 3, 15]] } },
    ]);
    const [work] = await searchCrossref("x");
    expect(work.published).toBe("2024-03-15");
    expect(work.publicationYear).toBe(2024);
    expect(work.datePrecision).toBe("day");
  });

  it("preserves month-precision dates", async () => {
    mockResponse([
      { DOI: "10.1/a", title: ["A"], URL: "https://doi.org/10.1/a", published: { "date-parts": [[2024, 3]] } },
    ]);
    const [work] = await searchCrossref("x");
    expect(work.published).toBe("2024-03");
    expect(work.datePrecision).toBe("month");
  });

  it("never fabricates a day/month for a year-only date", async () => {
    mockResponse([
      { DOI: "10.1/a", title: ["A"], URL: "https://doi.org/10.1/a", published: { "date-parts": [[2024]] } },
    ]);
    const [work] = await searchCrossref("x");
    expect(work.published).toBeUndefined();
    expect(work.publicationYear).toBe(2024);
    expect(work.datePrecision).toBe("year");
  });

  it("parses real authors with ORCID, never fabricating a missing one", async () => {
    mockResponse([
      {
        DOI: "10.1/a",
        title: ["A"],
        URL: "https://doi.org/10.1/a",
        author: [
          { given: "Jane", family: "Smith", ORCID: "https://orcid.org/0000-0001-2345-6789" },
          { given: "John", family: "Doe" },
        ],
      },
    ]);
    const [work] = await searchCrossref("x");
    expect(work.authors).toEqual([
      { givenName: "Jane", familyName: "Smith", orcid: "0000-0001-2345-6789" },
      { givenName: "John", familyName: "Doe", orcid: undefined },
    ]);
  });

  it("drops an author entry with no family name rather than fabricating one", async () => {
    mockResponse([
      { DOI: "10.1/a", title: ["A"], URL: "https://doi.org/10.1/a", author: [{ given: "Jane" }] },
    ]);
    const [work] = await searchCrossref("x");
    expect(work.authors).toEqual([]);
  });

  it("preserves container title and work type when present", async () => {
    mockResponse([
      {
        DOI: "10.1/a",
        title: ["A"],
        URL: "https://doi.org/10.1/a",
        "container-title": ["Journal of Examples"],
        type: "journal-article",
      },
    ]);
    const [work] = await searchCrossref("x");
    expect(work.containerTitle).toBe("Journal of Examples");
    expect(work.workType).toBe("journal-article");
  });

  it("returns an empty list on a provider failure rather than throwing", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false } as Response);
    expect(await searchCrossref("x")).toEqual([]);
  });
});
