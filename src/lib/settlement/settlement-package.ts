import { createHash } from "node:crypto";

export type SettlementPackagePayee = {
  obligationId: string;
  identityId: string;
  payoutDestinationId: string;
  address: string;
  amountUsdcMicro: string;
  evidenceIds: string[];
};

export type CanonicalSettlementPackage = {
  version: 1;
  communityId: string;
  programId: string;
  programVersionId: string;
  policyVersionId: string;
  obligationIds: string[];
  payees: SettlementPackagePayee[];
  totalUsdcMicro: string;
  evidenceRootHash: string;
  simulationId: string;
  preparedAt: string;
};

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
}

export function hashCanonicalSettlementValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(value))).digest("hex");
}

export function compileSettlementPackage(input: {
  communityId: string;
  programId: string;
  programVersionId: string;
  policyVersionId: string;
  payees: SettlementPackagePayee[];
  evidenceContentHashes: string[];
  simulationId: string;
  preparedAt: string;
}): { package: CanonicalSettlementPackage; packageHash: string } {
  const payees = input.payees
    .map((payee) => ({
      ...payee,
      address: payee.address.toLowerCase(),
      evidenceIds: [...new Set(payee.evidenceIds)].sort(),
    }))
    .sort((left, right) => left.obligationId.localeCompare(right.obligationId));
  const totalUsdcMicro = payees
    .reduce((total, payee) => total + BigInt(payee.amountUsdcMicro), BigInt(0))
    .toString();
  const evidenceRootHash = hashCanonicalSettlementValue(
    [...new Set(input.evidenceContentHashes)].sort(),
  );
  const settlementPackage: CanonicalSettlementPackage = {
    version: 1,
    communityId: input.communityId,
    programId: input.programId,
    programVersionId: input.programVersionId,
    policyVersionId: input.policyVersionId,
    obligationIds: payees.map((payee) => payee.obligationId),
    payees,
    totalUsdcMicro,
    evidenceRootHash,
    simulationId: input.simulationId,
    preparedAt: input.preparedAt,
  };
  return {
    package: settlementPackage,
    packageHash: hashCanonicalSettlementValue(settlementPackage),
  };
}

export function verifySettlementPackage(
  settlementPackage: CanonicalSettlementPackage,
  expectedHash: string,
): boolean {
  return hashCanonicalSettlementValue(settlementPackage) === expectedHash;
}
