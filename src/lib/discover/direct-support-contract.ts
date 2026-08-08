import { z } from "zod";
import { isHash } from "viem";

export const directSupportRequestSchema = z.object({
  destinationAddress: z.string().optional(),
  recipientUserId: z.string().min(1).optional(),
  amountUsd: z.number().min(0.01).max(10_000),
  idempotencyKey: z.string().uuid(),
  fundingSource: z.enum(["app", "external"]).default("app"),
  txHash: z.string().optional(),
}).refine((value) => Boolean(value.destinationAddress) !== Boolean(value.recipientUserId), {
  message: "Choose either a destination address or a verified recipient.",
}).superRefine((value, context) => {
  if (value.fundingSource === "external" && (!value.txHash || !isHash(value.txHash))) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["txHash"],
      message: "A confirmed Arc transaction hash is required for a connected-wallet payment.",
    });
  }
  if (value.fundingSource === "app" && value.txHash) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["txHash"],
      message: "The RESOLVE wallet creates its own Arc transaction.",
    });
  }
});

export type DirectSupportRequest = z.infer<typeof directSupportRequestSchema>;

export function directSupportActionKey(userId: string, idempotencyKey: string) {
  return `direct-support:${userId}:${idempotencyKey}`;
}
