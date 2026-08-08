import { describe, expect, it } from "vitest";
import {
  directSupportActionKey,
  directSupportRequestSchema,
} from "../../src/lib/discover/direct-support-contract";
import {
  discoverNavigationAction,
  workbenchAction,
} from "../../src/lib/discover/marketplace/action-contract";
import { canonicalOutcomeHref } from "../../src/lib/discover/receipt-links";

const operationId = "b759c8c1-5176-4b64-ac23-ce9d94b78d6e";
const transactionHash = `0x${"1".repeat(64)}`;

describe("Discover final action contracts", () => {
  it("requires exactly one recipient target and a stable idempotency key", () => {
    expect(directSupportRequestSchema.safeParse({
      recipientUserId: "recipient-1",
      amountUsd: 5,
      idempotencyKey: operationId,
      fundingSource: "app",
    }).success).toBe(true);
    expect(directSupportRequestSchema.safeParse({
      destinationAddress: "0x1111111111111111111111111111111111111111",
      recipientUserId: "recipient-1",
      amountUsd: 5,
      idempotencyKey: operationId,
      fundingSource: "app",
    }).success).toBe(false);
    expect(directSupportActionKey("user-1", operationId)).toBe(
      `direct-support:user-1:${operationId}`,
    );
  });

  it("requires a transaction hash only for a connected-wallet transfer", () => {
    expect(directSupportRequestSchema.safeParse({
      recipientUserId: "recipient-1",
      amountUsd: 5,
      idempotencyKey: operationId,
      fundingSource: "external",
    }).success).toBe(false);
    expect(directSupportRequestSchema.safeParse({
      recipientUserId: "recipient-1",
      amountUsd: 5,
      idempotencyKey: operationId,
      fundingSource: "external",
      txHash: transactionHash,
    }).success).toBe(true);
    expect(directSupportRequestSchema.safeParse({
      recipientUserId: "recipient-1",
      amountUsd: 5,
      idempotencyKey: operationId,
      fundingSource: "app",
      txHash: transactionHash,
    }).success).toBe(false);
  });

  it("keeps workbench and navigation actions as separate discriminated variants", () => {
    const workbench = workbenchAction({
      id: "capital.open_funding",
      label: "Support with USDC",
      href: "/discover?view=explore&kind=people",
    }, {
      panel: "direct_support",
      subjectId: "person-1",
      recipientUserId: "person-1",
      recipientLabel: "Ada",
    }, { requiresConfirmation: true });
    const navigation = discoverNavigationAction({
      id: "discover.open_repository",
      label: "Open GitHub",
      href: "https://github.com/ada",
    }, { target: "external", secondary: true });

    expect(workbench).toMatchObject({
      enabled: true,
      requiresConfirmation: true,
      presentation: { kind: "workbench", target: { panel: "direct_support" } },
    });
    expect(navigation).toMatchObject({
      enabled: true,
      presentation: { kind: "navigation", target: "external", secondary: true },
    });
  });

  it("routes canonical receipts through their public outcome reference", () => {
    expect(canonicalOutcomeHref("support_abc/123")).toBe(
      "/outcomes/support_abc%2F123",
    );
    expect(() => canonicalOutcomeHref("   ")).toThrow(
      "A receipt public reference is required.",
    );
  });
});
