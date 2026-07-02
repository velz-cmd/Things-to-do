/** Parse API JSON safely — avoids opaque "Unexpected end of JSON input" errors. */
export async function parseJsonResponse<T = Record<string, unknown>>(
  res: Response,
): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.ok
        ? "Empty server response — try again in a moment"
        : `Request failed (${res.status}) — server returned no body`,
    );
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    if (res.status === 504 || res.status === 502) {
      throw new Error("Request timed out — try again in a moment");
    }
    throw new Error(
      res.ok
        ? "Could not read server response — try again"
        : `Something went wrong (${res.status}) — try again`,
    );
  }
}
