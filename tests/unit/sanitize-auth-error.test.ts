import { describe, expect, it } from "vitest";
import { sanitizeAuthApiError } from "../../src/lib/auth/sanitize-auth-error";

describe("sanitizeAuthApiError", () => {
  it("hides Prisma table missing errors from users", () => {
    const raw =
      'Invalid `prisma.passwordResetToken.updateMany()` invocation: The table `public.PasswordResetToken` does not exist in the current database.';
    expect(sanitizeAuthApiError(raw)).toBe(
      "Account service is updating. Try again in a minute, or use wallet sign-in.",
    );
  });

  it("passes through short user-safe messages", () => {
    expect(sanitizeAuthApiError("Wrong email or password.")).toBe(
      "Wrong email or password.",
    );
  });
});
