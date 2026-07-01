import { describe, expect, it } from "vitest";
import { classifySentiment } from "../../src/lib/agent/sentiment";
import { matchServiceForPrompt } from "../../src/lib/agent/commerce-match";
import { listDiscoverableAgentServices } from "../../src/lib/agent/service-registry";

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

  it("lists discoverable x402 micro-services", () => {
    const services = listDiscoverableAgentServices();
    expect(services.some((s) => s.id === "sentiment-per-request")).toBe(true);
    expect(services.some((s) => s.id === "citation-verify")).toBe(true);
    expect(services.some((s) => s.id === "docs-review")).toBe(true);
    expect(services.some((s) => s.id === "security-signal")).toBe(true);
    expect(services.find((s) => s.id === "sentiment-per-request")?.priceUsd).toBe(0.001);
  });

  it("matches React maintainer intel to docs-review", () => {
    const svc = matchServiceForPrompt("Run intel on React maintainers");
    expect(svc?.id).toBe("docs-review");
  });
});
