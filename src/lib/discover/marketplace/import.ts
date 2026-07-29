import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { OPPORTUNITY_TYPES } from "./contracts";

const sourceSchema = z.enum([
  "admin",
  "approved_file",
  "community",
  "founder",
  "funding_pool",
  "repository_publication",
  "approved_integration",
]);

export const importedOpportunitySchema = z
  .object({
    sourceRecordId: z.string().trim().min(1).max(160),
    slug: z
      .string()
      .trim()
      .min(3)
      .max(120)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),
    title: z.string().trim().min(3).max(180),
    summary: z.string().trim().min(10).max(500),
    description: z.string().trim().min(20).max(20_000),
    type: z.enum(OPPORTUNITY_TYPES),
    status: z.enum(["draft", "published", "open", "active", "closed"]),
    visibility: z.enum(["private", "unlisted", "public"]),
    creatorType: z.enum([
      "founder",
      "funder",
      "community",
      "dao",
      "individual",
      "creator",
      "maintainer",
      "agent",
      "organisation",
    ]),
    creatorId: z.string().trim().max(160).optional(),
    creatorName: z.string().trim().min(1).max(160),
    creatorAvatar: z.string().url().max(2_000).optional(),
    communityId: z.string().trim().max(160).optional(),
    communityName: z.string().trim().max(160).optional(),
    poolId: z.string().trim().max(160).optional(),
    poolName: z.string().trim().max(160).optional(),
    projectId: z.string().trim().max(500).optional(),
    repository: z.string().trim().max(300).optional(),
    category: z.string().trim().max(80).optional(),
    skills: z.array(z.string().trim().min(1).max(60)).max(24).default([]),
    deliverables: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
    evidenceRequirements: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
    eligibility: z.array(z.string().trim().min(1).max(500)).max(30).default([]),
    rewardAmountUsd: z.number().finite().nonnegative().optional(),
    rewardToken: z.string().trim().max(20).optional(),
    rewardNetwork: z.string().trim().max(80).optional(),
    fundedAmountUsd: z.number().finite().nonnegative().optional(),
    fundingGoalUsd: z.number().finite().positive().optional(),
    fundingStatus: z
      .enum(["unfunded", "partially_funded", "funded", "escrowed", "milestone_funded"])
      .optional(),
    paymentMode: z.string().trim().max(80).optional(),
    distributionMethod: z.string().trim().max(160).optional(),
    preferredProviderId: z.string().trim().max(160).optional(),
    preferredProviderName: z.string().trim().max(160).optional(),
    selectedProviderId: z.string().trim().max(160).optional(),
    selectedProviderName: z.string().trim().max(160).optional(),
    capacity: z.number().int().positive().optional(),
    deadline: z.string().datetime().optional(),
    location: z.string().trim().max(160).optional(),
    remote: z.boolean().optional(),
    estimatedDelivery: z.string().trim().max(160).optional(),
    verificationStatus: z
      .enum(["unverified", "configured", "verified", "review_required"])
      .default("unverified"),
    riskFlags: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
    publishedAt: z.string().datetime().optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .superRefine((value, context) => {
    if (
      value.visibility === "public" &&
      ["published", "open", "active"].includes(value.status) &&
      !value.publishedAt
    ) {
      context.addIssue({
        code: "custom",
        path: ["publishedAt"],
        message: "Public opportunities require a publication timestamp.",
      });
    }
    if (value.fundedAmountUsd != null && value.fundingGoalUsd != null) {
      const expected =
        value.fundedAmountUsd <= 0
          ? "unfunded"
          : value.fundedAmountUsd >= value.fundingGoalUsd
            ? "funded"
            : "partially_funded";
      if (
        value.fundingStatus &&
        !["escrowed", "milestone_funded", expected].includes(value.fundingStatus)
      ) {
        context.addIssue({
          code: "custom",
          path: ["fundingStatus"],
          message: "Funding status contradicts the funded and goal amounts.",
        });
      }
    }
    if (value.expiresAt && value.publishedAt) {
      if (new Date(value.expiresAt) <= new Date(value.publishedAt)) {
        context.addIssue({
          code: "custom",
          path: ["expiresAt"],
          message: "Expiry must be after publication.",
        });
      }
    }
    if (value.selectedProviderId && !value.selectedProviderName) {
      context.addIssue({
        code: "custom",
        path: ["selectedProviderName"],
        message: "A selected provider requires a public display name.",
      });
    }
  });

export const importBatchSchema = z.object({
  source: sourceSchema,
  records: z.array(z.unknown()).min(1).max(250),
});

export type ImportBatch = z.infer<typeof importBatchSchema>;

function slugify(title: string, sourceRecordId: string) {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 72) || "opportunity";
  const hash = createHash("sha256").update(sourceRecordId).digest("hex").slice(0, 8);
  return `${base}-${hash}`;
}

function payloadHash(payload: unknown) {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function rejectionMessage(error: z.ZodError) {
  return error.issues
    .slice(0, 6)
    .map((issue) => `${issue.path.join(".") || "record"}: ${issue.message}`)
    .join("; ");
}

export async function importDiscoverOpportunities(
  input: ImportBatch,
  startedByUserId?: string,
) {
  const requestId = randomUUID();
  const run = await prisma.discoverImportRun.create({
    data: {
      source: input.source,
      requestId,
      startedByUserId,
    },
  });
  let importedCount = 0;
  let rejectedCount = 0;
  let duplicateCount = 0;

  for (let index = 0; index < input.records.length; index += 1) {
    const raw = input.records[index];
    const parsed = importedOpportunitySchema.safeParse(raw);
    const fallbackId =
      raw && typeof raw === "object" && "sourceRecordId" in raw
        ? String((raw as { sourceRecordId: unknown }).sourceRecordId).slice(0, 160)
        : `record-${index + 1}`;
    const hash = payloadHash(raw);

    if (!parsed.success) {
      rejectedCount += 1;
      await prisma.discoverImportRecord.create({
        data: {
          runId: run.id,
          source: input.source,
          sourceRecordId: fallbackId,
          validationResult: "rejected",
          rejectionReason: rejectionMessage(parsed.error),
          inputPayload: raw as Prisma.InputJsonValue,
          payloadHash: hash,
        },
      });
      continue;
    }

    const record = parsed.data;
    const existing = await prisma.discoverOpportunity.findUnique({
      where: {
        sourceType_sourceId: {
          sourceType: input.source,
          sourceId: record.sourceRecordId,
        },
      },
      select: { id: true, slug: true },
    });
    const slug = existing?.slug ?? record.slug ?? slugify(record.title, record.sourceRecordId);
    const opportunity = await prisma.discoverOpportunity.upsert({
      where: {
        sourceType_sourceId: {
          sourceType: input.source,
          sourceId: record.sourceRecordId,
        },
      },
      create: {
        slug,
        title: record.title,
        summary: record.summary,
        description: record.description,
        type: record.type,
        status: record.status,
        visibility: record.visibility,
        creatorType: record.creatorType,
        creatorId: record.creatorId,
        creatorName: record.creatorName,
        creatorAvatar: record.creatorAvatar,
        communityId: record.communityId,
        communityName: record.communityName,
        poolId: record.poolId,
        poolName: record.poolName,
        projectId: record.projectId,
        repository: record.repository,
        category: record.category,
        skills: record.skills,
        deliverables: record.deliverables,
        evidenceRequirements: record.evidenceRequirements,
        eligibility: record.eligibility,
        rewardAmountUsd: record.rewardAmountUsd,
        rewardToken: record.rewardToken,
        rewardNetwork: record.rewardNetwork,
        fundedAmountUsd: record.fundedAmountUsd,
        fundingGoalUsd: record.fundingGoalUsd,
        fundingStatus: record.fundingStatus,
        paymentMode: record.paymentMode,
        distributionMethod: record.distributionMethod,
        preferredProviderId: record.preferredProviderId,
        preferredProviderName: record.preferredProviderName,
        selectedProviderId: record.selectedProviderId,
        selectedProviderName: record.selectedProviderName,
        capacity: record.capacity,
        deadline: record.deadline ? new Date(record.deadline) : null,
        location: record.location,
        remote: record.remote,
        estimatedDelivery: record.estimatedDelivery,
        sourceType: input.source,
        sourceId: record.sourceRecordId,
        verificationStatus: record.verificationStatus,
        riskFlags: record.riskFlags,
        publishedAt: record.publishedAt ? new Date(record.publishedAt) : null,
        expiresAt: record.expiresAt ? new Date(record.expiresAt) : null,
      },
      update: {
        title: record.title,
        summary: record.summary,
        description: record.description,
        type: record.type,
        status: record.status,
        visibility: record.visibility,
        creatorType: record.creatorType,
        creatorId: record.creatorId,
        creatorName: record.creatorName,
        creatorAvatar: record.creatorAvatar,
        communityId: record.communityId,
        communityName: record.communityName,
        poolId: record.poolId,
        poolName: record.poolName,
        projectId: record.projectId,
        repository: record.repository,
        category: record.category,
        skills: record.skills,
        deliverables: record.deliverables,
        evidenceRequirements: record.evidenceRequirements,
        eligibility: record.eligibility,
        rewardAmountUsd: record.rewardAmountUsd,
        rewardToken: record.rewardToken,
        rewardNetwork: record.rewardNetwork,
        fundedAmountUsd: record.fundedAmountUsd,
        fundingGoalUsd: record.fundingGoalUsd,
        fundingStatus: record.fundingStatus,
        paymentMode: record.paymentMode,
        distributionMethod: record.distributionMethod,
        preferredProviderId: record.preferredProviderId,
        preferredProviderName: record.preferredProviderName,
        selectedProviderId: record.selectedProviderId,
        selectedProviderName: record.selectedProviderName,
        capacity: record.capacity,
        deadline: record.deadline ? new Date(record.deadline) : null,
        location: record.location,
        remote: record.remote,
        estimatedDelivery: record.estimatedDelivery,
        verificationStatus: record.verificationStatus,
        riskFlags: record.riskFlags,
        publishedAt: record.publishedAt ? new Date(record.publishedAt) : null,
        expiresAt: record.expiresAt ? new Date(record.expiresAt) : null,
        sourceVersion: { increment: 1 },
      },
    });
    if (existing) duplicateCount += 1;
    else importedCount += 1;
    await prisma.discoverImportRecord.create({
      data: {
        runId: run.id,
        source: input.source,
        sourceRecordId: record.sourceRecordId,
        validationResult: existing ? "updated_duplicate" : "imported",
        duplicateOpportunityId: existing?.id,
        normalizedOpportunityId: opportunity.id,
        publishedStatus:
          record.visibility === "public" ? record.status : "not_public",
        inputPayload: raw as Prisma.InputJsonValue,
        payloadHash: hash,
      },
    });
  }

  await prisma.discoverImportRun.update({
    where: { id: run.id },
    data: {
      status: rejectedCount === input.records.length ? "failed" : "completed",
      importedCount,
      rejectedCount,
      duplicateCount,
      completedAt: new Date(),
    },
  });

  return { runId: run.id, requestId, importedCount, rejectedCount, duplicateCount };
}
