import { describe, expect, it } from "vitest";
import type { MissionSession } from "../../src/lib/mission/toolbox/mission-library";
import {
  filterMeaningfulMissionSessions,
  isMeaningfulMissionSession,
} from "../../src/lib/mission/mission-session-filter";

function session(partial: Partial<MissionSession>): MissionSession {
  return {
    id: "s-1",
    title: "Test",
    kind: "mission",
    query: "hello",
    savedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...partial,
  };
}

describe("mission-session-filter", () => {
  it("hides empty new missions", () => {
    expect(isMeaningfulMissionSession(session({ title: "New mission", turns: [] }))).toBe(false);
  });

  it("shows chats with a user turn", () => {
    expect(
      isMeaningfulMissionSession(
        session({
          turns: [{ id: "u1", role: "user", text: "Fund React maintainers" }],
        }),
      ),
    ).toBe(true);
  });

  it("filters list to meaningful only", () => {
    const list = filterMeaningfulMissionSessions([
      session({ id: "a", title: "New mission", turns: [] }),
      session({
        id: "b",
        turns: [{ id: "u1", role: "user", text: "Royalty batch" }],
      }),
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]?.id).toBe("b");
  });
});
