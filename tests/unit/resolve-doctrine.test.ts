import { describe, expect, it } from "vitest";
import {
  RESOLVE_DOCTRINE,
  RESOLVE_EXISTENTIAL_THESIS,
  RESOLVE_SETTLEMENT_LINE,
  RESOLVE_VALUE_CHAIN,
} from "../../src/lib/discover/resolve-doctrine";

describe("resolve doctrine", () => {
  it("states existential thesis", () => {
    expect(RESOLVE_EXISTENTIAL_THESIS).toContain("already knows who creates value");
  });

  it("states product doctrine", () => {
    expect(RESOLVE_DOCTRINE).toContain("programmable capital");
  });

  it("includes memory in value chain", () => {
    expect(RESOLVE_VALUE_CHAIN.some((s) => s.stage === "Memory")).toBe(true);
    expect(RESOLVE_VALUE_CHAIN).toHaveLength(8);
  });

  it("positions settlement split", () => {
    expect(RESOLVE_SETTLEMENT_LINE).toContain("decides where");
  });
});
