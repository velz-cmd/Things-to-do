import { describe, expect, it } from "vitest";
import { circleErrorMessage, CIRCLE_ENTITY_SECRET_SETUP_HINT } from "../../src/lib/wallet/circle-errors";

describe("circle-errors", () => {
  it("maps entity secret API codes to setup hint", () => {
    const msg = circleErrorMessage({ code: 156013, message: "entity secret invalid" });
    expect(msg).toContain("entity secret");
    expect(msg).toContain(CIRCLE_ENTITY_SECRET_SETUP_HINT.slice(0, 40));
  });

  it("passes through generic errors", () => {
    expect(circleErrorMessage(new Error("Insufficient balance"))).toBe("Insufficient balance");
  });
});
