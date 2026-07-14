/** Replaces any stale OAuth context and only permits application-local return paths. */
export function profileAuthorizeUrl(href: string, returnTo: string): string {
  const url = new URL(href, "https://resolve.local");
  url.searchParams.set("returnTo", returnTo.startsWith("/") ? returnTo : "/profile");
  return `${url.pathname}${url.search}${url.hash}`;
}
