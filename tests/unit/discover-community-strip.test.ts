import { describe, expect, it } from "vitest";
import {
  communityStripActions,
  defaultProgramTemplateForCommunity,
} from "../../src/lib/discover/community-strip-actions";

describe("community strip actions", () => {
  it("always includes Open", () => {
    const actions = communityStripActions({ slug: "navidrome", installed: false });
    expect(actions.map((a) => a.label)).toEqual(["Open"]);
    expect(actions[0].href).toBe("/communities/navidrome");
  });

  it("adds Create program when installed", () => {
    const actions = communityStripActions({ slug: "react", installed: true });
    expect(actions.map((a) => a.label)).toContain("Open");
    expect(actions.map((a) => a.label)).toContain("Create program");
    const create = actions.find((a) => a.id === "program");
    expect(create?.communitySlug).toBe("react");
    expect(create?.templateId).toBeTruthy();
  });

  it("picks a default template per community slug", () => {
    expect(defaultProgramTemplateForCommunity("navidrome")).toBeTruthy();
    expect(defaultProgramTemplateForCommunity("react")).toBeTruthy();
  });
});
