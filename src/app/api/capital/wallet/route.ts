import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { ArcRpcUnavailableError, getArcUsdcBalance } from "@/lib/wallet/arc-usdc-balance";
import { resolveUserWallet, shortWalletAddress } from "@/lib/wallet/resolve-user-wallet";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PROFILE_BUDGET_MS = 2_500;

type CapitalWalletOk = {
  ok: true;
  wallet: {
    address: string;
    shortAddress: string;
    source: string;
    externalAddress?: string;
  };
  balance: {
    totalUsdc: string;
    nativeUsdc: string;
    erc20Usdc: string;
    chainId: number;
    blockNumber: number;
    syncedAt: string;
    reservedUsd: number;
    spendableUsd: string;
  };
  account: {
    email: string | null;
    displayName: string | null;
  } | null;
  warnings: string[];
};

async function loadProfileLight(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      walletAddress: true,
      scanWalletAddress: true,
      embeddedWallet: true,
      taskMemoryJson: true,
    },
  });
}

async function getReservedUsd(userId: string): Promise<number> {
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
  return Math.round((agg._sum.amountUsd ?? 0) * 100) / 100;
}

/** Wallet + Arc RPC first — never block balance on Circle wallet provisioning or heavy profile setup. */
export async function GET() {
  const authUser = await getSessionUser();
  if (!authUser) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: "Sign in to view your wallet." },
      { status: 401 },
    );
  }

  const warnings: string[] = [];

  const profilePromise = Promise.race([
    loadProfileLight(authUser.id),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), PROFILE_BUDGET_MS)),
  ]);

  const resolved = resolveUserWallet(authUser.id, null, authUser);

  try {
    const [chainBalance, profile] = await Promise.all([
      getArcUsdcBalance(resolved.address),
      profilePromise,
    ]);

    const walletResolved = resolveUserWallet(authUser.id, profile, authUser);
    if (!profile) {
      warnings.push("Account metadata unavailable");
    }

    const reservedUsd = profile ? await getReservedUsd(profile.id).catch(() => 0) : 0;
    const total = Number(chainBalance.totalUsdc);
    const spendable = Math.max(0, total - reservedUsd);

    const body: CapitalWalletOk = {
      ok: true,
      wallet: {
        address: walletResolved.address,
        shortAddress: shortWalletAddress(walletResolved.address),
        source: walletResolved.source,
        ...(walletResolved.externalAddress ?
          { externalAddress: walletResolved.externalAddress }
        : {}),
      },
      balance: {
        totalUsdc: chainBalance.totalUsdc,
        nativeUsdc: chainBalance.nativeUsdc,
        erc20Usdc: chainBalance.erc20Usdc,
        chainId: chainBalance.chainId,
        blockNumber: chainBalance.blockNumber,
        syncedAt: chainBalance.syncedAt,
        reservedUsd,
        spendableUsd: spendable.toFixed(2),
      },
      account: {
        email: profile?.email ?? authUser.email ?? null,
        displayName:
          profile?.displayName ??
          (authUser.user_metadata?.full_name as string | undefined) ??
          authUser.email?.split("@")[0] ??
          null,
      },
      warnings,
    };

    return NextResponse.json(body);
  } catch (e) {
    const profile = await profilePromise.catch(() => null);
    const walletResolved = resolveUserWallet(authUser.id, profile, authUser);

    if (e instanceof ArcRpcUnavailableError) {
      return NextResponse.json(
        {
          ok: false,
          code: e.code,
          message: e.message,
          wallet: {
            address: walletResolved.address,
            shortAddress: shortWalletAddress(walletResolved.address),
            source: walletResolved.source,
          },
        },
        { status: 503 },
      );
    }

    console.error("[capital/wallet]", e);
    return NextResponse.json(
      {
        ok: false,
        code: "ARC_RPC_UNAVAILABLE",
        message: "Could not sync Arc balance. Try again.",
        wallet: {
          address: walletResolved.address,
          shortAddress: shortWalletAddress(walletResolved.address),
          source: walletResolved.source,
        },
      },
      { status: 503 },
    );
  }
}
