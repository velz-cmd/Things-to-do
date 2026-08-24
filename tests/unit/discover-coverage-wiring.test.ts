import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Phase 5 Release Slice 8 regression guard: proves the real production
 * data-loading path (query.ts's loadDiscoverPageData) actually calls
 * loadCoverageBySourceId() and passes its result into attachEconomicMatch(),
 * not only that the pure loader/matcher functions work in isolation.
 * coverageBySourceId was previously never populated in the live call at
 * all - this is exactly the class of "real code path exists but is
 * unreachable" bug this session has repeatedly found, so the regression
 * guard checks the real wiring, not just the pure function.
 *
 * Release Slice 13: loadCoverageBySourceId() now returns a real result
 * object (recordsBySourceId + confirmed/pendingAvailability) instead of a
 * bare Map - this guard now also proves the real availability flag is
 * threaded through, not silently dropped.
 */
describe("Real coverage is wired into the live query path, not just the pure matcher", () => {
  const source = readFileSync("src/lib/discover/marketplace/query.ts", "utf8");

  it("imports loadCoverageBySourceId from the real coverage loader", () => {
    expect(source).toContain(
      'import { loadCoverageBySourceId } from "./coverage-loader"',
    );
  });

  it("calls loadCoverageBySourceId with real work-domain source ids before attachEconomicMatch", () => {
    const loadIndex = source.indexOf("await loadCoverageBySourceId(coverageSourceIds)");
    const matchCallIndex = source.indexOf("const matched = attachEconomicMatch(workAware, {");
    expect(loadIndex).toBeGreaterThan(-1);
    expect(matchCallIndex).toBeGreaterThan(-1);
    expect(loadIndex).toBeLessThan(matchCallIndex);
  });

  it("passes the real loaded records into attachEconomicMatch as coverageBySourceId, not a hardcoded empty value", () => {
    const start = source.indexOf("const matched = attachEconomicMatch(workAware, {");
    const end = source.indexOf("});", start);
    const call = source.slice(start, end);
    expect(call).toContain("coverageBySourceId: coverageLoad.recordsBySourceId,");
    expect(call).not.toContain("coverageBySourceId: new Map()");
    expect(call).not.toContain("coverageBySourceId: undefined");
  });

  it("Release Slice 13: passes real coverage availability through, never hardcoded true", () => {
    const start = source.indexOf("const matched = attachEconomicMatch(workAware, {");
    const end = source.indexOf("});", start);
    const call = source.slice(start, end);
    expect(call).toContain("coverageDataAvailable:");
    expect(call).toContain("coverageLoad.confirmedAvailability === \"available\"");
    expect(call).toContain("coverageLoad.pendingAvailability === \"available\"");
  });

  it("Release Slice 13: passes real policy provenance availability through, never hardcoded true", () => {
    const start = source.indexOf("const matched = attachEconomicMatch(workAware, {");
    const end = source.indexOf("});", start);
    const call = source.slice(start, end);
    expect(call).toContain("policyProvenanceAvailable: policyProvenanceLoad.availability === \"available\"");
  });
});
