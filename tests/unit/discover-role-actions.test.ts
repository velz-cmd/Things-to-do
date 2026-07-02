import { describe, expect, it } from "vitest";
import { discoverActionsForRole } from "../../src/lib/discover/discover-role-actions";
import type { DiscoverAction } from "../../src/lib/discover/types";

const sample: DiscoverAction[] = [
  { id: "fund", label: "Fund", kind: "fund", communitySlug: "react" },
  { id: "program", label: "Create rule", kind: "create_program", communitySlug: "react" },
  { id: "scan", label: "Scan", kind: "analyze", communitySlug: "react" },
];

describe("discoverActionsForRole", () => {
  it("funder sees fund only", () => {
    const actions = discoverActionsForRole("funder", sample);
    expect(actions.map((a) => a.kind)).toEqual(["fund"]);
  });

  it("founder sees operate and fund actions", () => {
    const actions = discoverActionsForRole("founder", sample);
    expect(actions.some((a) => a.kind === "create_program")).toBe(true);
    expect(actions.some((a) => a.kind === "fund")).toBe(true);
  });
});
