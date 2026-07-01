import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { isMissingTableError } from "@/lib/db/prisma-errors";

describe("isMissingTableError", () => {
  it("detects Prisma P2021", () => {
    const err = new Prisma.PrismaClientKnownRequestError("table missing", {
      code: "P2021",
      clientVersion: "test",
    });
    expect(isMissingTableError(err)).toBe(true);
  });

  it("detects message heuristics", () => {
    expect(isMissingTableError(new Error('relation "UserEarningsSnapshot" does not exist'))).toBe(
      true,
    );
  });
});
