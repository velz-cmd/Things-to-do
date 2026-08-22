import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseFundingYaml, fetchFundingChannels } from "@/lib/integrations/github-funding-yaml";

describe("parseFundingYaml", () => {
  it("parses scalar provider values", () => {
    const channels = parseFundingYaml(`
patreon: myusername
open_collective: myproject
ko_fi: myusername
`);
    expect(channels).toEqual(
      expect.arrayContaining([
        { provider: "patreon", account: "myusername", url: "https://www.patreon.com/myusername" },
        { provider: "open_collective", account: "myproject", url: "https://opencollective.com/myproject" },
        { provider: "ko_fi", account: "myusername", url: "https://ko-fi.com/myusername" },
      ]),
    );
  });

  it("parses a bracketed inline list for github", () => {
    const channels = parseFundingYaml(`github: [alice, bob]`);
    expect(channels).toEqual([
      { provider: "github", account: "alice", url: "https://github.com/sponsors/alice" },
      { provider: "github", account: "bob", url: "https://github.com/sponsors/bob" },
    ]);
  });

  it("parses a YAML block list", () => {
    const channels = parseFundingYaml(`github:\n  - alice\n  - bob\n`);
    expect(channels.map((c) => c.account)).toEqual(["alice", "bob"]);
  });

  it("ignores unsupported/unknown provider keys", () => {
    const channels = parseFundingYaml(`some_unknown_provider: whatever\npatreon: real`);
    expect(channels).toEqual([
      { provider: "patreon", account: "real", url: "https://www.patreon.com/real" },
    ]);
  });

  it("never throws and yields no channels for malformed content", () => {
    expect(() => parseFundingYaml("{{{ not yaml at all ]][[")).not.toThrow();
    expect(parseFundingYaml("{{{ not yaml at all ]][[")).toEqual([]);
  });

  it("dedupes duplicate entries for the same provider+url", () => {
    const channels = parseFundingYaml(`github: [alice, alice]`);
    expect(channels).toHaveLength(1);
  });

  it("accepts only http(s) custom URLs, rejecting dangerous schemes", () => {
    const channels = parseFundingYaml(
      `custom: ["https://example.com/donate", "javascript:alert(1)", "file:///etc/passwd"]`,
    );
    expect(channels).toEqual([
      { provider: "custom", account: "https://example.com/donate", url: "https://example.com/donate" },
    ]);
  });

  it("rejects an account value that isn't a bare handle for non-custom providers", () => {
    const channels = parseFundingYaml(`patreon: "javascript:alert(1)"`);
    expect(channels).toEqual([]);
  });

  it("rejects path traversal in an account value", () => {
    const channels = parseFundingYaml(`open_collective: "../../etc/passwd"`);
    expect(channels).toEqual([]);
  });
});

describe("fetchFundingChannels", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });
  afterEach(() => fetchSpy.mockRestore());

  it("returns undefined when the file does not exist (provider 404)", async () => {
    fetchSpy.mockResolvedValueOnce({ ok: false, status: 404 } as Response);
    const result = await fetchFundingChannels("acme", "widgets");
    expect(result).toBeUndefined();
  });

  it("returns undefined on a provider error rather than throwing", async () => {
    fetchSpy.mockRejectedValueOnce(new Error("network outage"));
    const result = await fetchFundingChannels("acme", "widgets");
    expect(result).toBeUndefined();
  });

  it("parses a real base64-encoded FUNDING.yml response", async () => {
    const raw = "patreon: real\n";
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: Buffer.from(raw, "utf8").toString("base64"),
        encoding: "base64",
      }),
    } as Response);
    const result = await fetchFundingChannels("acme", "widgets");
    expect(result).toEqual([
      { provider: "patreon", account: "real", url: "https://www.patreon.com/real" },
    ]);
  });

  it("returns an empty array (not undefined) when the file exists but defines nothing recognized", async () => {
    const raw = "unknown_provider: whatever\n";
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        content: Buffer.from(raw, "utf8").toString("base64"),
        encoding: "base64",
      }),
    } as Response);
    const result = await fetchFundingChannels("acme", "widgets");
    expect(result).toEqual([]);
  });
});
