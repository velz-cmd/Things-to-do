import { describe, expect, it } from "vitest";
import { circleErrorMessage, circleUserMessage } from "../../src/lib/wallet/circle-errors";

describe("circleUserMessage", () => {
  it("maps entity secret errors to user-friendly copy", () => {
    const err = { code: 156019, message: "rotate the entity secret first" };
    expect(circleUserMessage(err)).toMatch(/Connected wallet/i);
    expect(circleUserMessage(err)).not.toMatch(/Vercel/i);
  });

  it("keeps operator hints in circleErrorMessage", () => {
    const err = { code: 156013, message: "invalid entity secret" };
    expect(circleErrorMessage(err)).toMatch(/CIRCLE-SETUP/i);
  });
});
