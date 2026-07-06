import { describe, expect, it } from "vitest";
import { normalizeCircleEntitySecret } from "../../src/lib/wallet/circle-secret";

describe("normalizeCircleEntitySecret", () => {
  it("strips colon from Vercel export format", () => {
    const raw = "403ad5ec668bcac23e90b83dce76fe31:b799de515ec46ac83f7e1fe8f0c57faa";
    expect(normalizeCircleEntitySecret(raw)).toBe(
      "403ad5ec668bcac23e90b83dce76fe31b799de515ec46ac83f7e1fe8f0c57faa",
    );
  });

  it("returns null for invalid values", () => {
    expect(normalizeCircleEntitySecret("TEST_API_KEY:abc")).toBeNull();
    expect(normalizeCircleEntitySecret("")).toBeNull();
  });
});
