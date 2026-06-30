import { NextResponse } from "next/server";
import { getSessionUser, ensureProfileForUser } from "@/lib/auth/session";
import { ArcRpcUnavailableError, getArcUsdcBalance } from "@/lib/wallet/arc-usdc-balance";
import { resolveUserWallet, shortWalletAddress } from "@/lib/wallet/resolve-user-wallet";
import { getReservedForPrograms } from "@/lib/wallet/sync-identity-balance";

export const dynamic = "force-dynamic";

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

export async function GET() {
  const authUser = await getSessionUser();
  if (!authUser) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: "Sign in to view your wallet." },
      { status: 401 },
    );
  }

  const warnings: string[] = [];
  let profile = null;

  try {
    profile = await ensureProfileForUser(authUser);
  } catch (e) {
    console.error("[capital/wallet] profile", e);
    warnings.push("Account metadata unavailable");
  }

  const resolved = resolveUserWallet(authUser.id, profile, authUser);
  if (!resolved.address) {
    return NextResponse.json({
      ok: false,
      code: "WALLET_NOT_FOUND",
      message: "No RESOLVE wallet is attached to this account.",
    });
  }

  try {
    const [chainBalance, reservedUsd] = await Promise.all([
      getArcUsdcBalance(resolved.address),
      profile ? getReservedForPrograms(profile.id).catch(() => 0) : Promise.resolve(0),
    ]);

    const total = Number(chainBalance.totalUsdc);
    const spendable = Math.max(0, total - reservedUsd);

    const body: CapitalWalletOk = {
      ok: true,
      wallet: {
        address: resolved.address,
        shortAddress: shortWalletAddress(resolved.address),
        source: resolved.source,
        ...(resolved.externalAddress ?
          { externalAddress: resolved.externalAddress }
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
      account:
        profile || authUser.email ?
          {
            email: profile?.email ?? authUser.email ?? null,
            displayName:
              profile?.displayName ??
              (authUser.user_metadata?.full_name as string | undefined) ??
              authUser.email?.split("@")[0] ??
              null,
          }
        : null,
      warnings,
    };

    return NextResponse.json(body);
  } catch (e) {
    if (e instanceof ArcRpcUnavailableError) {
      return NextResponse.json(
        {
          ok: false,
          code: e.code,
          message: e.message,
          wallet: {
            address: resolved.address,
            shortAddress: shortWalletAddress(resolved.address),
            source: resolved.source,
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
          address: resolved.address,
          shortAddress: shortWalletAddress(resolved.address),
          source: resolved.source,
        },
      },
      { status: 503 },
    );
  }
}
