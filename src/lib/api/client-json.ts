export class HttpResponseError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: "http_error" | "empty_response" | "invalid_json",
  ) {
    super(message);
    this.name = "HttpResponseError";
  }
}

export async function readJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new HttpResponseError(
      `The server returned an empty response (${response.status}).`,
      response.status,
      "empty_response",
    );
  }

  let data: T;
  try {
    data = JSON.parse(text) as T;
  } catch {
    throw new HttpResponseError(
      `The server returned invalid JSON (${response.status}).`,
      response.status,
      "invalid_json",
    );
  }

  if (!response.ok) {
    const payload = data as { error?: unknown; message?: unknown };
    const detail =
      typeof payload?.error === "string"
        ? payload.error
        : typeof payload?.message === "string"
          ? payload.message
          : `Request failed (${response.status}).`;
    throw new HttpResponseError(detail, response.status, "http_error");
  }

  return data;
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, init);
  return readJsonResponse<T>(response);
}
