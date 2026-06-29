/** Client event — profile identity or community install state changed. */
export const PROFILE_REFRESH_EVENT = "resolve.profile.refresh";

export function dispatchProfileRefresh() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(PROFILE_REFRESH_EVENT));
  }
}
