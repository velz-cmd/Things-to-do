const GUEST_ID_KEY = "resolve.guest.id";
const GUEST_MODE_KEY = "resolve.guest.exploring";
const NOTIFICATION_EMAIL_KEY = "resolve.notification.email";

export function getOrCreateGuestId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = localStorage.getItem(GUEST_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(GUEST_ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export function isGuestExploring(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(GUEST_MODE_KEY) === "1";
  } catch {
    return false;
  }
}

export function enableGuestExploring(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(GUEST_MODE_KEY, "1");
    getOrCreateGuestId();
  } catch {
    /* ignore */
  }
}

export function clearGuestExploring(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(GUEST_MODE_KEY);
  } catch {
    /* ignore */
  }
}

export function getLocalNotificationEmail(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return localStorage.getItem(NOTIFICATION_EMAIL_KEY) ?? undefined;
  } catch {
    return undefined;
  }
}

export function setLocalNotificationEmail(email: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(NOTIFICATION_EMAIL_KEY, email.trim().toLowerCase());
  } catch {
    /* ignore */
  }
}

export const GMAIL_AFTER_AUTH_KEY = "resolve.gmail.afterAuth";
