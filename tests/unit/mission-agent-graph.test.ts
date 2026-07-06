import { describe, expect, it } from "vitest";
import {
  deriveMissionAgentGraph,
  missionGraphComplete,
} from "../../src/lib/mission/mission-agent-graph";

describe("deriveMissionAgentGraph", () => {
  it("keeps all agents waiting before a mission starts", () => {
    const stages = deriveMissionAgentGraph({
      loading: false,
      missionPhase: "discover",
      loopPhase: "observe",
      turns: [],
      blueprintActive: false,
      simulated: false,
    });
    expect(stages.every((s) => s.status === "waiting")).toBe(true);
  });

  it("marks research running during initial load", () => {
    const stages = deriveMissionAgentGraph({
      loading: true,
      missionPhase: "discover",
      loopPhase: "observe",
      turns: [{ role: "user" }],
      blueprintActive: false,
      simulated: false,
    });
    expect(stages[0]?.status).toBe("running");
    expect(stages[1]?.status).toBe("waiting");
  });

  it("marks evidence done after a brief arrives", () => {
    const stages = deriveMissionAgentGraph({
      loading: false,
      thinkingComplete: true,
      missionPhase: "discover",
      loopPhase: "understand",
      turns: [{ role: "resolve", brief: { title: "x" } }],
      blueprintActive: false,
      simulated: false,
    });
    expect(stages[0]?.status).toBe("done");
    expect(stages[1]?.status).toBe("done");
  });

  it("marks simulation done when blueprint is simulated", () => {
    const stages = deriveMissionAgentGraph({
      loading: false,
      missionPhase: "plan",
      loopPhase: "simulate",
      turns: [{ role: "resolve", blueprint: { prompt: "x" } }],
      blueprintActive: true,
      simulated: true,
    });
    expect(stages[4]?.status).toBe("done");
  });

  it("detects a fully complete graph in execute phase", () => {
    const stages = deriveMissionAgentGraph({
      loading: false,
      missionPhase: "execute",
      loopPhase: "execute",
      turns: [
        { role: "resolve", brief: {}, blueprint: {}, allocations: [{}] },
      ],
      blueprintActive: true,
      simulated: true,
    });
    expect(missionGraphComplete(stages)).toBe(true);
  });
});
