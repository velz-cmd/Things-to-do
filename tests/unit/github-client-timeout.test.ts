import { afterEach, describe, expect, it, vi } from "vitest";
import { githubFetch } from "@/lib/github/client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("githubFetch", () => {
  it("adds a bounded request signal when the caller does not provide one", async () => {
    let requestSignal: AbortSignal | null | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      requestSignal = init?.signal;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));

    await expect(githubFetch<{ ok: boolean }>("https://api.github.com/repos/example/repo"))
      .resolves.toEqual({ ok: true });
    expect(requestSignal).toBeInstanceOf(AbortSignal);
  });

  it("preserves a caller-provided request signal", async () => {
    const controller = new AbortController();
    let requestSignal: AbortSignal | null | undefined;
    vi.stubGlobal("fetch", vi.fn(async (_url: string, init?: RequestInit) => {
      requestSignal = init?.signal;
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }));

    await githubFetch("https://api.github.com/repos/example/repo", {
      signal: controller.signal,
    });

    expect(requestSignal).toBe(controller.signal);
  });
});
