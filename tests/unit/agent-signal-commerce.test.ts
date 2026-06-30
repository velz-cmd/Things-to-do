import { describe, expect, it } from "vitest";
import { classifySentiment } from "@/lib/agent/sentiment";
import { matchServiceForPrompt } from "@/lib/agent/commerce";
import { listDiscoverableAgentServices } from "@/lib/agent/service-registry";

describe("agent sentiment", () => {
  it("classifies positive and negative feedback", () => {
    expect(classifySentiment("I love this product, amazing support!").label).toBe("positive");
    expect(classifySentiment("Terrible experience, want a refund").label).toBe("negative");
  });
});

describe("agent commerce", () => {
  it("matches Circle-style sentiment prompts", () => {
    const svc = matchServiceForPrompt(
      "My data pipeline needs sentiment analysis for customer feedback",
    );
    expect(svc?.id).toBe("sentiment-per-request");
  });

  it("lists discoverable services including x402 and RFB", () => {
    const services = listDiscoverableAgentServices();
    expect(services.some((s) => s.id === "sentiment-per-request")).toBe(true);
    expect(services.some((s) => s.rfbProgram === "RFB #7")).toBe(true);
  });
});
