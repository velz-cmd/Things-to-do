import { describe, expect, it } from "vitest";
import {
  isEvmWalletAddress,
  parseFundQueueFilter,
  parseMaintainerHandle,
  parseOwnerRepo,
  pickPrimaryAction,
  trimSearchActions,
} from "../../src/lib/discover/search-helpers";
import type { DiscoverSearchResult } from "../../src/lib/discover/types";

describe("search-helpers", () => {
  it("parses owner/repo", () => {
    expect(parseOwnerRepo("navidrome/navidrome")).toEqual({
      owner: "navidrome",
      repo: "navidrome",
    });
  });

  it("parses @maintainer", () => {
    expect(parseMaintainerHandle("@octocat")).toBe("octocat");
  });

  it("parses fund queue filter", () => {
    expect(parseFundQueueFilter("fund react")).toBe("react");
  });

  it("detects evm wallet", () => {
    expect(isEvmWalletAddress("0x1234567890123456789012345678901234567890")).toBe(true);
    expect(isEvmWalletAddress("octocat")).toBe(false);
  });

  it("trims actions to max 4", () => {
    const trimmed = trimSearchActions([
      { id: "1", label: "Open", kind: "open" },
      { id: "2", label: "Fund", kind: "fund" },
      { id: "3", label: "Install", kind: "install" },
      { id: "4", label: "Claim", kind: "claim" },
      { id: "5", label: "Analyze", kind: "analyze" },
    ]);
    expect(trimmed).toHaveLength(4);
    expect(trimmed[0].kind).toBe("open");
  });

  it("picks fund as primary when present", () => {
    const result: DiscoverSearchResult = {
      id: "x",
      kind: "program",
      label: "Test",
      subtitle: "sub",
      dataSource: "supabase_ledger",
      actions: [
        { id: "open", label: "Open", kind: "open", href: "/x" },
        { id: "fund", label: "Fund", kind: "fund", programId: "p1" },
      ],
    };
    expect(pickPrimaryAction(result).kind).toBe("fund");
  });
});
