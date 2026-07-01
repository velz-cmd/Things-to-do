import { describe, expect, it } from "vitest";
import { Prisma } from "@prisma/client";
import { isMissingTableError, isPrismaUnavailableError } from "@/lib/db/prisma-errors";

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

describe("isPrismaUnavailableError", () => {
  it("detects Prisma initialization errors", () => {
    const err = new Prisma.PrismaClientInitializationError("nonempty URL", "P1012");
    expect(isPrismaUnavailableError(err)).toBe(true);
  });

  it("detects empty DATABASE_URL messages", () => {
    expect(
      isPrismaUnavailableError(
        new Error("You must provide a nonempty URL. The environment variable DATABASE_URL"),
      ),
    ).toBe(true);
  });
});
