/** Client-side sign-in flow persistence (magic link cooldown + verify step). */

export const SIGN_IN_COOLDOWN_KEY = "resolve.signin.cooldownUntil";
export const SIGN_IN_EMAIL_KEY = "resolve.signin.email";
export const SIGN_IN_VERIFY_KEY = "resolve.signin.verifyPending";

export function getSignInCooldownRemaining(): number {
  try {
    const until = Number(localStorage.getItem(SIGN_IN_COOLDOWN_KEY) ?? 0);
    return Math.max(0, Math.ceil((until - Date.now()) / 1000));
  } catch {
    return 0;
  }
}

export function setSignInCooldownSeconds(seconds: number) {
  try {
    localStorage.setItem(
      SIGN_IN_COOLDOWN_KEY,
      String(Date.now() + seconds * 1000)
    );
  } catch {
    /* ignore */
  }
}

export function markSignInVerifyPending(email: string) {
  try {
    localStorage.setItem(SIGN_IN_EMAIL_KEY, email.trim().toLowerCase());
    localStorage.setItem(SIGN_IN_VERIFY_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function hasSignInVerifyPending(): boolean {
  try {
    return localStorage.getItem(SIGN_IN_VERIFY_KEY) === "1";
  } catch {
    return false;
  }
}

/** Clear cooldown + verify flags after sign-out or successful sign-in. */
export function clearSignInFlowState() {
  try {
    localStorage.removeItem(SIGN_IN_COOLDOWN_KEY);
    localStorage.removeItem(SIGN_IN_VERIFY_KEY);
  } catch {
    /* ignore */
  }
}

export function formatSignInCooldown(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins <= 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
}
