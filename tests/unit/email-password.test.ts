import { describe, expect, it } from "vitest";
import {
  continueWithEmailPassword,
  isInvalidLogin,
  mapPasswordAuthError,
} from "../../src/lib/auth/email-password";

describe("isInvalidLogin", () => {
  it("detects Supabase invalid credentials message", () => {
    expect(isInvalidLogin("Invalid login credentials")).toBe(true);
  });

  it("does not match mapped user-facing message", () => {
    expect(isInvalidLogin("Wrong email or password.")).toBe(false);
  });
});

describe("continueWithEmailPassword", () => {
  it("creates account when sign-in fails with invalid credentials", async () => {
    const calls: string[] = [];
    const supabase = {
      auth: {
        signInWithPassword: async () => {
          calls.push("signIn");
          return {
            error: { message: "Invalid login credentials" },
            data: { user: null, session: null },
          };
        },
        signUp: async () => {
          calls.push("signUp");
          return {
            error: null,
            data: {
              user: { id: "new-user" },
              session: { access_token: "token" },
            },
          };
        },
      },
    };

    const result = await continueWithEmailPassword(
      supabase as never,
      "new@example.com",
      "password123",
    );

    expect(result.ok).toBe(true);
    expect(calls).toEqual(["signIn", "signUp"]);
  });

  it("does not sign up when sign-in fails for other reasons", async () => {
    const supabase = {
      auth: {
        signInWithPassword: async () => ({
          error: { message: "Email not confirmed" },
          data: { user: null, session: null },
        }),
        signUp: async () => {
          throw new Error("signUp should not be called");
        },
      },
    };

    const result = await continueWithEmailPassword(
      supabase as never,
      "user@example.com",
      "password123",
    );

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Confirm your email");
  });
});

describe("mapPasswordAuthError", () => {
  it("maps invalid login to user-safe copy", () => {
    expect(mapPasswordAuthError("Invalid login credentials")).toBe(
      "Wrong email or password.",
    );
  });
});
