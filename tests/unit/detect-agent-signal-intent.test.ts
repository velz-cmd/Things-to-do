import { describe, expect, it } from "vitest";
import { detectAgentSignalIntent } from "../../src/lib/mission/detect-agent-signal-intent";

describe("detectAgentSignalIntent", () => {
  it("detects run intel prompts", () => {
    expect(
      detectAgentSignalIntent("Run intel on React maintainers — docs gaps and contributor health"),
    ).toBe(true);
  });

  it("detects maintainer and docs keywords", () => {
    expect(detectAgentSignalIntent("Score documentation quality for our OSS repo")).toBe(true);
  });

  it("ignores generic funding prompts", () => {
    expect(detectAgentSignalIntent("Fund the top maintainers in React with $50k")).toBe(false);
  });

  it("detects explicit agent verbs", () => {
    expect(detectAgentSignalIntent("Run agent on sentiment for this feedback")).toBe(true);
  });
});
