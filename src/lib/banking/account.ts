import { prisma } from "@/lib/db";
import { getProfileEarningsSummary } from "@/lib/earn/summary";
import { extractGithubIdentity } from "@/lib/identity/contributors";
import { getGlobalAuthorizationSummary } from "@/lib/authorization/ledger";
import { getTreasurySnapshot } from "@/lib/treasury/engine";
import { googleOAuthConfigured } from "@/lib/google/oauth";
import type { User } from "@prisma/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import {
  BANKING_POLICY,
  type BankingAccountSnapshot,
  type BankingProgramWallet,
  type StatementLine,
} from "@/lib/banking/types";

function round(n: number) {
  return Math.round(n * 100) / 100;
}

function walletLabel(address: string | null | undefined) {
  if (!address) return null;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

async function getReservedForPrograms(userId: string): Promise<number> {
  const programs = await prisma.resolveProgram.findMany({
    where: { userId, status: { in: ["active", "deployed"] }, missionId: { not: null } },
    select: { missionId: true },
  });
  const missionIds = programs.map((p) => p.missionId!).filter(Boolean);
  if (!missionIds.length) return 0;

  const agg = await prisma.paymentAuthorization.aggregate({
    where: { missionId: { in: missionIds }, status: "claimable" },
    _sum: { amountUsd: true },
  });
  return round(agg._sum.amountUsd ?? 0);
}

async function getTotalDeposited(userId: string): Promise<number> {
  const agg = await prisma.walletTransaction.aggregate({
    where: { userId, type: "deposit", status: "completed" },
    _sum: { amountUsd: true },
  });
  return round(agg._sum.amountUsd ?? 0);
}

async function buildProgramWallets(userId: string): Promise<BankingProgramWallet[]> {
  const programs = await prisma.resolveProgram.findMany({
    where: { userId },
    include: { install: { select: { communitySlug: true } } },
    orderBy: { updatedAt: "desc" },
    take: 12,
  });

  const out: BankingProgramWallet[] = [];
  for (const p of programs) {
    let committedUsd = 0;
    let authorizedUsd = 0;
    if (p.missionId) {
      const [claimable, authorized] = await Promise.all([
        prisma.paymentAuthorization.aggregate({
          where: { missionId: p.missionId, status: "claimable" },
          _sum: { amountUsd: true },
        }),
        prisma.paymentAuthorization.aggregate({
          where: { missionId: p.missionId, status: "authorized" },
          _sum: { amountUsd: true },
        }),
      ]);
      committedUsd = claimable._sum.amountUsd ?? 0;
      authorizedUsd = authorized._sum.amountUsd ?? 0;
    }
    out.push({
      id: p.id,
      name: p.name,
      communitySlug: p.install?.communitySlug ?? "unknown",
      budgetUsd: p.budgetUsd,
      committedUsd: round(committedUsd),
      authorizedUsd: round(authorizedUsd),
      status: p.status,
    });
  }
  return out;
}

async function buildStatement(userId: string, availableUsd: number): Promise<StatementLine[]> {
  const txs = await prisma.walletTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 24,
  });

  const lines: StatementLine[] = txs.map((t) => ({
    id: t.id,
    at: t.createdAt.toISOString(),
    type:
      t.type === "deposit" ? "deposit"
      : t.type === "withdrawal" ? "distribution"
      : "adjustment",
    direction: t.amountUsd >= 0 ? "credit" : "debit",
    amountUsd: round(Math.abs(t.amountUsd)),
    balanceAfterUsd: null,
    label:
      t.type === "deposit" ?
        t.method === "crypto" ? "USDC deposit (Arc)"
        : t.method === "card" ? "Card deposit"
        : "Deposit"
      : t.label ?? t.type,
    reference: t.label?.startsWith("crypto:") ? t.label.replace("crypto:", "") : t.label,
  }));

  const programReserve = await prisma.paymentAuthorization.findMany({
    where: {
      status: "claimable",
      missionId: {
        in: (
          await prisma.resolveProgram.findMany({
            where: { userId },
            select: { missionId: true },
          })
        )
          .map((p) => p.missionId)
          .filter((id): id is string => Boolean(id)),
      },
    },
    orderBy: { updatedAt: "desc" },
    take: 8,
    select: {
      id: true,
      amountUsd: true,
      contextLabel: true,
      updatedAt: true,
      missionId: true,
    },
  });

  for (const row of programReserve) {
    lines.push({
      id: `reserve-${row.id}`,
      at: row.updatedAt.toISOString(),
      type: "program_reserve",
      direction: "debit",
      amountUsd: round(row.amountUsd),
      balanceAfterUsd: availableUsd,
      label: `Program reserve · ${row.contextLabel ?? row.missionId}`,
      reference: row.missionId,
    });
  }

  return lines
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 20);
}

export async function getBankingAccountSnapshot(input: {
  authUser: SupabaseUser | null;
  profile: User | null;
}): Promise<BankingAccountSnapshot> {
  const [ledger, treasury] = await Promise.all([
    getGlobalAuthorizationSummary().catch(() => ({
      authorizedUsd: 0,
      claimableUsd: 0,
      settledUsd: 0,
      pendingFundingUsd: 0,
      count: 0,
    })),
    getTreasurySnapshot().catch(() => ({
      balanceUsd: 0,
      fundingWallet: null,
    })),
  ]);

  if (!input.authUser || !input.profile) {
    return {
      ok: true,
      signedIn: false,
      accountId: null,
      displayName: null,
      email: null,
      memberSince: null,
      walletAddress: null,
      walletLabel: null,
      policy: BANKING_POLICY,
      balances: {
        availableUsd: 0,
        reservedUsd: 0,
        earnedClaimableUsd: 0,
        earnedAuthorizedUsd: 0,
        earnedSettledUsd: 0,
        totalDepositedUsd: 0,
      },
      programs: [],
      statement: [],
      network: {
        authorizedUsd: ledger.authorizedUsd,
        claimableUsd: ledger.claimableUsd,
        settledUsd: ledger.settledUsd,
        pendingFundingUsd: ledger.pendingFundingUsd,
      },
      settlementRail: {
        balanceUsd: treasury.balanceUsd,
        wallet: treasury.fundingWallet,
        role: "On-chain payout rail — not user spendable balance",
      },
      identities: {
        github: null,
        emailVerified: false,
        gmailConnected: false,
        gmailOperatorLive: googleOAuthConfigured() && Boolean(process.env.GOOGLE_REFRESH_TOKEN?.trim()),
      },
      updatedAt: new Date().toISOString(),
    };
  }

  const { authUser, profile } = input;
  const gh = extractGithubIdentity(authUser);
  const github = gh.login ?? profile.githubUsername ?? null;
  const walletAddress = profile.walletAddress ?? profile.scanWalletAddress ?? null;

  const [reservedUsd, totalDepositedUsd, programs, statement, earnings] = await Promise.all([
    getReservedForPrograms(profile.id),
    getTotalDeposited(profile.id),
    buildProgramWallets(profile.id),
    buildStatement(profile.id, profile.availableUsd),
    getProfileEarningsSummary({ profile, authUser }),
  ]);

  return {
    ok: true,
    signedIn: true,
    accountId: profile.id,
    displayName:
      profile.displayName ??
      authUser.user_metadata?.full_name ??
      authUser.email?.split("@")[0] ??
      null,
    email: authUser.email ?? profile.email ?? null,
    memberSince: profile.createdAt.toISOString(),
    walletAddress,
    walletLabel: walletLabel(walletAddress),
    policy: BANKING_POLICY,
    balances: {
      availableUsd: round(profile.availableUsd),
      reservedUsd,
      earnedClaimableUsd: round(earnings.claimableUsd),
      earnedAuthorizedUsd: round(earnings.authorizedUsd),
      earnedSettledUsd: round(earnings.settledUsd),
      totalDepositedUsd,
    },
    programs,
    statement,
    network: {
      authorizedUsd: ledger.authorizedUsd,
      claimableUsd: ledger.claimableUsd,
      settledUsd: ledger.settledUsd,
      pendingFundingUsd: ledger.pendingFundingUsd,
    },
    settlementRail: {
      balanceUsd: treasury.balanceUsd,
      wallet: treasury.fundingWallet,
      role: "On-chain payout rail — not user spendable balance",
    },
    identities: {
      github: github ? `@${github}` : null,
      emailVerified: Boolean(authUser.email_confirmed_at ?? authUser.email),
      gmailConnected: profile.gmailConnected,
      gmailOperatorLive: googleOAuthConfigured() && Boolean(process.env.GOOGLE_REFRESH_TOKEN?.trim()),
    },
    updatedAt: new Date().toISOString(),
  };
}
