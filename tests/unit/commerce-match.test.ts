import { describe, expect, it } from "vitest";
import { matchServiceForPrompt } from "../../src/lib/agent/commerce-match";

describe("matchServiceForPrompt", () => {
  it("does not match royalty settlement prompts to attribution", () => {
    const match = matchServiceForPrompt(
      "Prepare royalty settlement for independent music artists — show play-weighted payees.",
    );
    expect(match).toBeNull();
  });

  it("matches labeled attribution prompts", () => {
    const match = matchServiceForPrompt("artist: Luna Hart · track: Midnight Echo");
    expect(match?.id).toBe("attribution-signal");
  });
});
