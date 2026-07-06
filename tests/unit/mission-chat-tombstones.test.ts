import { describe, expect, it, beforeEach, vi } from "vitest";
import {
  addMissionChatTombstone,
  filterOutTombstonedSessions,
  getMissionChatTombstones,
} from "../../src/lib/mission/mission-chat-tombstones";

describe("mission-chat-tombstones", () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v;
      },
      removeItem: (k: string) => {
        delete store[k];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
    });
  });

  it("filters tombstoned session ids", () => {
    addMissionChatTombstone("chat-a");
    const out = filterOutTombstonedSessions([
      { id: "chat-a" },
      { id: "chat-b" },
    ]);
    expect(out).toEqual([{ id: "chat-b" }]);
  });

  it("persists tombstones in localStorage", () => {
    addMissionChatTombstone("x-1");
    expect(getMissionChatTombstones().has("x-1")).toBe(true);
  });
});
