import { z } from "zod";

const repositorySchema = z
  .string()
  .trim()
  .regex(/^[\w.-]+\/[\w.-]+$/, "Use owner/repository format")
  .optional();

const createRequestSchema = z.object({
  action: z.literal("create"),
  idempotencyKey: z.string().uuid(),
  title: z.string().trim().min(5).max(160),
  description: z.string().trim().min(30).max(8_000),
  repository: repositorySchema,
  communityName: z.string().trim().min(2).max(120).optional(),
  requestType: z.enum([
    "task",
    "bounty",
    "repository_fix",
    "research_request",
  ]),
  evidenceRequirement: z.string().trim().min(8).max(500),
  acceptanceRequirement: z.string().trim().min(8).max(1_000),
  budgetUsd: z.number().min(0.01).max(10_000),
  deadline: z.string().datetime().optional(),
});

const requestActionBase = z.object({
  opportunityId: z.string().trim().min(1).max(240),
  idempotencyKey: z.string().uuid(),
});

export const discoverRequestCommandSchema = z.discriminatedUnion("action", [
  createRequestSchema,
  requestActionBase.extend({
    action: z.literal("take"),
    proposal: z.string().trim().min(20).max(4_000),
  }),
  requestActionBase.extend({
    action: z.literal("fund_publish"),
  }),
  requestActionBase.extend({
    action: z.literal("submit_work"),
    evidenceIds: z.array(z.string().trim().min(1).max(240)).min(1).max(20),
    note: z.string().trim().min(10).max(4_000),
  }),
  requestActionBase.extend({
    action: z.literal("approve"),
    note: z.string().trim().min(3).max(1_000),
  }),
  requestActionBase.extend({
    action: z.literal("release"),
  }),
  requestActionBase.extend({
    action: z.literal("refund"),
    reason: z.string().trim().min(3).max(1_000),
  }),
]);

export type DiscoverRequestCommand = z.infer<
  typeof discoverRequestCommandSchema
>;

export const DISCOVER_REQUEST_STATUSES = [
  "ready_to_fund",
  "open",
  "assigned",
  "under_review",
  "approved",
  "payment_submitted",
  "confirmed",
  "cancelled",
  "refunded",
] as const;
