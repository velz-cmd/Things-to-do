import assert from "node:assert/strict";
import test from "node:test";
import {
  erc20UnitsToMicroUsdc,
  microUsdcToString,
  nativeWeiToMicroUsdc,
  reconcileArcUsdcInterfaces,
} from "../../src/lib/arc/usdc-units";
import {
  calculateCapitalWalletAmounts,
  preserveConfirmedBalance,
} from "../../src/lib/capital/balance-state";
import { resolveCanonicalWalletRegistry } from "../../src/lib/wallet/canonical-wallet-registry";

test("normalizes Arc native 18-decimal USDC to micro-USDC", () => {
  assert.equal(nativeWeiToMicroUsdc(64_920_000_000_000_000_000n), 64_920_000n);
});

test("keeps ERC-20 6-decimal USDC in micro-USDC", () => {
  assert.equal(erc20UnitsToMicroUsdc(64_920_000n), 64_920_000n);
});

test("reconciles native and ERC-20 interfaces without adding them", () => {
  const result = reconcileArcUsdcInterfaces({
    nativeWei: 64_920_000_000_000_000_000n,
    erc20Units: 64_920_000n,
  });
  assert.equal(result.amountMicroUsdc, 64_920_000n);
  assert.equal(result.mismatch, false);
  assert.equal(microUsdcToString(result.amountMicroUsdc), "64.92");
});

test("preserves the last confirmed balance when every live provider fails", () => {
  assert.equal(preserveConfirmedBalance(64_920_000n, null, false), 64_920_000n);
});

test("selected wallet controls available value while portfolio remains separate", () => {
  const selected = calculateCapitalWalletAmounts({
    appMicroUsdc: 64_920_000n,
    connectedMicroUsdc: 33_780_000n,
    reservedMicroUsdc: 25_000_000n,
    selectedWallet: "connected",
  });
  assert.equal(selected.selectedBalanceMicroUsdc, 33_780_000n);
  assert.equal(selected.availableMicroUsdc, 33_780_000n);
  assert.equal(selected.portfolioTotalMicroUsdc, 98_700_000n);
});

test("canonical wallet registry does not substitute payout or connected wallets", () => {
  const registry = resolveCanonicalWalletRegistry({
    userId: "user-1",
    profile: {
      walletAddress: "0x1111111111111111111111111111111111111111",
      scanWalletAddress: "0x2222222222222222222222222222222222222222",
      embeddedWallet: true,
      selectedCapitalWallet: "connected",
      updatedAt: "2026-07-14T00:00:00.000Z",
    },
    appWalletId: "wallet-1",
    appWalletProvider: "circle",
    payoutDestination: {
      address: "0x3333333333333333333333333333333333333333",
      status: "verified",
    },
  });

  assert.equal(registry.appWallet?.address, "0x1111111111111111111111111111111111111111");
  assert.equal(registry.connectedWallet?.address, "0x2222222222222222222222222222222222222222");
  assert.equal(registry.payoutWallet?.address, "0x3333333333333333333333333333333333333333");
  assert.equal(registry.selectedCapitalWallet, "connected");
});

test("invalid connected selection falls back to the app wallet", () => {
  const registry = resolveCanonicalWalletRegistry({
    userId: "user-1",
    profile: {
      walletAddress: "0x1111111111111111111111111111111111111111",
      scanWalletAddress: null,
      embeddedWallet: true,
      selectedCapitalWallet: "connected",
      updatedAt: "2026-07-14T00:00:00.000Z",
    },
  });
  assert.equal(registry.selectedCapitalWallet, "app");
});
