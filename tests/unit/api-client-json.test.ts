import { describe, expect, it } from "vitest";
import { HttpResponseError, readJsonResponse } from "@/lib/api/client-json";

describe("readJsonResponse", () => {
  it("returns parsed JSON for a successful response", async () => {
    await expect(readJsonResponse<{ ok: boolean }>(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )).resolves.toEqual({ ok: true });
  });

  it("classifies an empty upstream response instead of leaking JSON syntax errors", async () => {
    const error = await readJsonResponse(new Response(null, { status: 504 })).catch((value) => value);
    expect(error).toBeInstanceOf(HttpResponseError);
    expect(error).toMatchObject({ status: 504, code: "empty_response" });
  });

  it("preserves an API error message", async () => {
    const error = await readJsonResponse(
      new Response(JSON.stringify({ error: "profile_state_unavailable" }), { status: 503 }),
    ).catch((value) => value);
    expect(error).toMatchObject({
      message: "profile_state_unavailable",
      status: 503,
      code: "http_error",
    });
  });
});
