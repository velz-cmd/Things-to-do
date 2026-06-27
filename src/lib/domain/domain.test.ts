import { describe, expect, it } from "vitest";
import type { SettlementInputEvent } from "@/lib/authorization/types";
import {
  EntityIds,
  parseEntityRef,
  validateObservation,
  observationToRelationships,
  settlementInputToObservation,
  ARCHITECTURE_LAYERS,
  CURRENT_LAYER,
} from "@/lib/domain";

describe("Layer 1 — Core Domain", () => {
  it("freezes entity ID conventions", () => {
    expect(EntityIds.repository("vercel", "next.js")).toBe("repo:vercel/next.js");
    expect(EntityIds.personGitHub("Octocat")).toBe("person:github:octocat");
  });

  it("parses canonical entity refs", () => {
    expect(parseEntityRef("repo:vercel/next.js")).toEqual({
      type: "repository",
      id: "repo:vercel/next.js",
    });
  });

  it("validates observations", () => {
    const errors = validateObservation({
      id: "",
      idempotencyKey: "k1",
      connectorId: "github",
      kind: "code_contribution",
      observedAt: new Date().toISOString(),
      subject: { type: "repository", id: "repo:a/b" },
      confidence: 0.9,
      proofHash: "abc",
      evidenceRefs: [],
    });
    expect(errors).toContain("id is required");
  });

  it("adapts SettlementInputEvent → Observation", () => {
    const event: SettlementInputEvent = {
      connectorId: "github",
      eventType: "code_contribution",
      occurredAt: "2026-01-01T00:00:00.000Z",
      missionId: "m1",
      idempotencyKey: "idem-1",
      payeeKeyType: "github_username",
      payeeKey: "alice",
      amountUsd: 100,
      proofHash: "proof",
      evidenceRefs: ["ev:1"],
      contextLabel: "vercel/next.js",
    };
    const obs = settlementInputToObservation(event);
    expect(obs.kind).toBe("code_contribution");
    expect(obs.object?.id).toBe("repo:vercel/next.js");
    expect(obs.actor?.id).toBe("person:github:alice");
  });

  it("materializes relationships from observations", () => {
    const obs = settlementInputToObservation({
      connectorId: "github",
      eventType: "code_contribution",
      occurredAt: "2026-01-01T00:00:00.000Z",
      missionId: "m1",
      idempotencyKey: "idem-2",
      payeeKeyType: "github_username",
      payeeKey: "bob",
      amountUsd: 50,
      proofHash: "proof",
      evidenceRefs: [],
      contextLabel: "vercel/next.js",
    });
    const rels = observationToRelationships(obs);
    expect(rels).toHaveLength(1);
    expect(rels[0].type).toBe("contributed_to");
    expect(rels[0].to.id).toBe("repo:vercel/next.js");
  });

  it("declares brain as current architecture layer", () => {
    expect(CURRENT_LAYER).toBe("brain");
    expect(ARCHITECTURE_LAYERS[0].id).toBe("brain");
    expect(ARCHITECTURE_LAYERS[5].status).toBe("not_started"); // workspace blocked
  });
});
