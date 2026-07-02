import type { SupabaseClient } from "@supabase/supabase-js";

export type EmailPasswordResult =
  | { ok: true; isNewUser?: boolean }
  | {
      ok: false;
      message: string;
      suggestForgotPassword?: boolean;
    };

export function isInvalidLogin(message: string) {
  return message.toLowerCase().includes("invalid login credentials");
}

function isAlreadyRegistered(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("user already registered") ||
    lower.includes("already been registered") ||
    lower.includes("already registered") ||
    lower.includes("email address has already been")
  );
}

export function mapPasswordAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (isInvalidLogin(message)) {
    return "Wrong email or password.";
  }
  if (isAlreadyRegistered(message)) {
    return "An account with this email already exists.";
  }
  if (lower.includes("password should be at least")) {
    return "Password must be at least 6 characters.";
  }
  if (lower.includes("email not confirmed")) {
    return "Confirm your email first, or turn off “Confirm email” in Supabase Auth settings.";
  }
  if (lower.includes("signup is disabled")) {
    return "New sign-ups are disabled. Contact support.";
  }
  return message;
}

async function trySignIn(
  supabase: SupabaseClient,
  email: string,
  password: string,
): Promise<EmailPasswordResult & { invalidCredentials?: boolean }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (!error) return { ok: true };
  const invalidCredentials = isInvalidLogin(error.message);
  return {
    ok: false,
    message: mapPasswordAuthError(error.message),
    suggestForgotPassword: invalidCredentials,
    invalidCredentials,
  };
}

async function trySignUp(
  supabase: SupabaseClient,
  email: string,
  password: string,
): Promise<EmailPasswordResult & { existingUser?: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return {
      ok: false,
      message: mapPasswordAuthError(error.message),
      existingUser: isAlreadyRegistered(error.message),
    };
  }

  if (data.session) {
    return { ok: true, isNewUser: true };
  }

  const signIn = await supabase.auth.signInWithPassword({ email, password });
  if (!signIn.error) {
    return { ok: true, isNewUser: true };
  }

  if (isInvalidLogin(signIn.error.message)) {
    return {
      ok: false,
      message: mapPasswordAuthError(signIn.error.message),
      existingUser: true,
      suggestForgotPassword: true,
    };
  }

  return {
    ok: false,
    message:
      "Account created. Turn off “Confirm email” in Supabase for instant sign-in, or check your inbox.",
  };
}

/**
 * Professional single-flow auth (Notion/Linear style):
 * - Try sign-in first (returning users)
 * - If unknown credentials, create account (new users)
 * - If account exists but password wrong, offer password reset
 */
export async function continueWithEmailPassword(
  supabase: SupabaseClient,
  email: string,
  password: string,
): Promise<EmailPasswordResult> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed || password.length < 6) {
    return {
      ok: false,
      message: "Enter a valid email and password (6+ characters).",
    };
  }

  const signIn = await trySignIn(supabase, trimmed, password);
  if (signIn.ok) return signIn;

  if (!signIn.invalidCredentials) {
    return signIn;
  }

  const signUp = await trySignUp(supabase, trimmed, password);
  if (signUp.ok) return signUp;

  if (signUp.existingUser) {
    return {
      ok: false,
      message:
        "This email already has an account. Check your password, or reset it if you signed in with email link before.",
      suggestForgotPassword: true,
    };
  }

  return signUp;
}

export async function requestPasswordReset(
  supabase: SupabaseClient,
  email: string,
  redirectTo: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const trimmed = email.trim().toLowerCase();
  if (!trimmed) {
    return { ok: false, message: "Enter your email address." };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
    redirectTo,
  });

  if (error) {
    return { ok: false, message: mapPasswordAuthError(error.message) };
  }

  return { ok: true };
}
