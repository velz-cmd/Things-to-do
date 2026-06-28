"use client";

import Link from "next/link";
import {
  ArrowDownLeft,
  BadgeCheck,
  CircleDollarSign,
  Landmark,
  Layers,
  Shield,
  Wallet,
  Zap,
} from "lucide-react";
import { BlueGlowCard } from "@/components/resolve/ui/blue-glow-card";
import { Money } from "@/components/resolve/ui/money";
import { Button } from "@/components/resolve/ui/button";
import { CapitalCommunityPrograms } from "@/components/resolve/capital/capital-community-programs";
import { CapitalSettlementRow } from "@/components/resolve/capital/settlement-truth";
import { CurrencySelect } from "@/components/resolve/capital/currency-select";
import { FxSwapPanel } from "@/components/wallet/fx-swap-panel";
import { useAddFunds } from "@/components/wallet/add-funds-context";
import type { BankingAccountSnapshot, StatementLine } from "@/lib/banking/types";
import type { FxSwapHint, PayoutCurrency } from "@/lib/settlement/fx";

type SettlementRow = {
  id: string;
  label: string;
  amountUsd: number;
  txHash: string | null;
  status: string;
  at: string;
};

type ResolveBankingProps = {
  account: BankingAccountSnapshot | null;
  settlements: SettlementRow[];
  initialLoading: boolean;
  refreshing: boolean;
  signedIn: boolean;
  payoutWallet: string | null;
  payoutCurrency: PayoutCurrency;
  currencyOptions: { id: PayoutCurrency; label: string }[];
  fxHint: FxSwapHint | null;
  claiming: boolean;
  onPayoutCurrencyChange: (next: PayoutCurrency) => void;
  onClaim: () => void;
  onSignIn: () => void;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StatementRow({ line }: { line: StatementLine }) {
  const isCredit = line.direction === "credit";
  return (
    <li className="flex items-center justify-between gap-3 border-b border-white/[0.04] py-3 last:border-0">
      <div className="min-w-0">
        <p className="truncate text-sm text-white">{line.label}</p>
        <p className="text-[11px] text-resolve-muted">
          {formatDate(line.at)}
          {line.reference ? ` · ${line.reference.slice(0, 18)}` : ""}
        </p>
      </div>
      <p
        className={`shrink-0 text-sm font-medium tabular-nums ${
          isCredit ? "text-emerald-300" : "text-white"
        }`}
      >
        {isCredit ? "+" : "−"}
        <Money amount={line.amountUsd} size="sm" className="inline" />
      </p>
    </li>
  );
}

function IdentityPill({
  label,
  value,
  ok,
  href,
}: {
  label: string;
  value: string;
  ok: boolean;
  href?: string;
}) {
  const inner = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] ${
        ok ?
          "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
        : "border-white/10 bg-white/[0.03] text-resolve-muted"
      }`}
    >
      {ok ?
        <BadgeCheck className="h-3 w-3" />
      : <span className="h-1.5 w-1.5 rounded-full bg-white/20" />}
      <span className="text-resolve-muted-dim">{label}</span>
      <span className="text-white/90">{value}</span>
    </span>
  );
  if (href) {
    return (
      <Link href={href} className="hover:opacity-90">
        {inner}
      </Link>
    );
  }
  return inner;
}

/** RESOLVE Banking — custody account for every user (no interest, deposit-first). */
export function ResolveBanking({
  account,
  settlements,
  initialLoading,
  refreshing,
  signedIn,
  payoutWallet,
  payoutCurrency,
  currencyOptions,
  fxHint,
  claiming,
  onPayoutCurrencyChange,
  onClaim,
  onSignIn,
}: ResolveBankingProps) {
  const { openAddFunds } = useAddFunds();

  const balances = account?.balances;
  const network = account?.network;
  const arc = account?.arc;
  const yourClaimable = balances?.earnedClaimableUsd ?? 0;
  const yourDeposits = balances?.availableUsd ?? 0;
  const reserved = balances?.reservedUsd ?? 0;
  const onChainUsd = balances?.onChainUsdcUsd ?? arc?.identityWallet?.onChainUsdcUsd ?? null;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 lg:px-8">
      <header className="mb-8">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-resolve-accent">
          RESOLVE Banking · Arc USDC
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Where should money move?</h1>
        <p className="mt-2 text-sm text-resolve-muted">
          {account?.policy.tagline ??
            "Deposit · hold · distribute — no interest, no lending, one account for everyone"}
        </p>
        {signedIn && account?.displayName && (
          <p className="mt-3 text-xs text-resolve-muted">
            {account.displayName}
            {account.memberSince ? ` · member since ${formatDate(account.memberSince)}` : ""}
          </p>
        )}
      </header>

      <BlueGlowCard className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-resolve-muted-dim">
              Available balance
            </p>
            {initialLoading ?
              <p className="mt-2 text-sm text-resolve-muted">Loading…</p>
            : <>
                <p className="mt-2 text-4xl font-semibold tabular-nums text-white">
                  <Money amount={signedIn ? yourDeposits : 0} size="lg" />
                </p>
                <p className="mt-1 text-xs text-resolve-muted">
                  Arc USDC custody · Circle identity wallet · no yield
                </p>
                {onChainUsd !== null && (
                  <p className="mt-1 text-[11px] text-resolve-muted-dim">
                    On-chain wallet: <Money amount={onChainUsd} size="sm" className="inline" />
                  </p>
                )}
              </>
            }
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
            <Landmark className="h-5 w-5 text-resolve-accent" />
          </div>
        </div>

        {signedIn && (
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-5 sm:grid-cols-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">Reserved</p>
              <p className="mt-1 text-sm font-medium text-white">
                <Money amount={reserved} size="sm" className="inline" />
              </p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
                Total deposited
              </p>
              <p className="mt-1 text-sm font-medium text-white">
                <Money amount={balances?.totalDepositedUsd ?? 0} size="sm" className="inline" />
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1">
              <p className="text-[10px] uppercase tracking-wide text-resolve-muted-dim">
                Claimable earnings
              </p>
              <p className="mt-1 text-sm font-medium text-emerald-200">
                <Money amount={yourClaimable} size="sm" className="inline" />
              </p>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          {signedIn ?
            <Button onClick={() => openAddFunds()} className="gap-2">
              <ArrowDownLeft className="h-4 w-4" />
              Deposit USDC
            </Button>
          : <Button onClick={onSignIn}>Sign in to open account</Button>}
          {signedIn && (
            <Link
              href="/settings"
              className="inline-flex items-center justify-center gap-2 rounded-resolve px-5 py-2.5 text-sm font-semibold text-resolve-muted transition hover:bg-white/[0.06] hover:text-white"
            >
              <Shield className="h-4 w-4" />
              Connections
            </Link>
          )}
        </div>
        {refreshing && (
          <p className="mt-3 text-[10px] text-resolve-muted-dim">Refreshing account…</p>
        )}
      </BlueGlowCard>

      {signedIn && account?.identities && (
        <section className="mb-8 flex flex-wrap gap-2">
          <IdentityPill
            label="Arc wallet"
            value={
              arc?.identityWallet?.provider === "circle" ?
                `Circle ${account.walletLabel ?? ""}`
              : account.walletLabel ?? "Provisioning…"
            }
            ok={Boolean(account.walletAddress)}
          />
          {account.identities.github ?
            <IdentityPill label="GitHub" value={account.identities.github} ok />
          : <IdentityPill label="GitHub" value="Link on Profile" ok={false} href="/profile" />}
          <IdentityPill
            label="Email"
            value={account.identities.emailVerified ? "Verified" : "Unverified"}
            ok={account.identities.emailVerified}
          />
          <IdentityPill
            label="Gmail"
            value={
              account.identities.gmailConnected ? "Linked"
              : account.identities.gmailOperatorLive ? "Connect in Settings"
              : "Operator pending"
            }
            ok={account.identities.gmailConnected}
            href="/settings"
          />
        </section>
      )}

      {!initialLoading && network && (network.authorizedUsd > 0 || network.pendingFundingUsd > 0) && (
        <div className="mb-8 rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm">
          <p className="font-medium text-amber-100">Recognized ≠ funded yet</p>
          <p className="mt-1 text-xs leading-relaxed text-amber-200/80">
            <Money amount={network.authorizedUsd} size="sm" className="inline text-white" />{" "}
            recognized across the network. Program operators deposit USDC to their account before
            authorizations become claimable — the platform settlement rail never funds user
            programs.
          </p>
          {signedIn && yourDeposits < 0.01 && network.authorizedUsd > 0 && (
            <p className="mt-2 text-xs text-amber-200/90">
              Your deposit balance is $0 —{" "}
              <button
                type="button"
                onClick={() => openAddFunds()}
                className="text-resolve-accent hover:underline"
              >
                deposit USDC
              </button>{" "}
              to fund programs you operate.
            </p>
          )}
        </div>
      )}

      <section className="mb-8 rounded-lg border border-resolve-accent/20 bg-resolve-accent/[0.04] px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wide text-resolve-accent">
              <CircleDollarSign className="h-3.5 w-3.5" />
              Circle Arc rail
            </p>
            <p className="mt-2 text-sm text-white">
              {arc?.live ?
                "Live — memo batch payouts & agent nano-payments on Arc USDC"
              : arc?.message ?? "Arc rail configuring…"}
            </p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
              arc?.canDistribute ?
                "bg-emerald-500/15 text-emerald-200"
              : "bg-amber-500/15 text-amber-200"
            }`}
          >
            {arc?.canDistribute ? "Live" : "Standby"}
          </span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase text-resolve-muted-dim">Settlement wallet</p>
            <p className="mt-1 text-sm text-white">
              <Money amount={arc?.settlementBalanceUsd ?? 0} size="sm" className="inline" />
            </p>
            <p className="mt-0.5 font-mono text-[10px] text-resolve-muted">
              {arc?.settlementWallet ?
                `${arc.settlementWallet.slice(0, 8)}…${arc.settlementWallet.slice(-6)}`
              : "Not configured"}
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2">
            <p className="text-[10px] uppercase text-resolve-muted-dim">Your deposit address</p>
            <p className="mt-1 font-mono text-xs text-white">
              {arc?.identityWallet?.depositAddress ?
                `${arc.identityWallet.depositAddress.slice(0, 10)}…${arc.identityWallet.depositAddress.slice(-8)}`
              : "Sign in to provision"}
            </p>
            <p className="mt-0.5 text-[10px] text-resolve-muted">
              One Circle wallet per identity — not a new address per payment
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[10px]">
          {arc?.capabilities.batchMemoPayouts && (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-resolve-muted">
              <Layers className="h-3 w-3" /> Batch memos
            </span>
          )}
          {arc?.capabilities.agentNanoPayments && (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-resolve-muted">
              <Zap className="h-3 w-3" /> Agent nano-pay
            </span>
          )}
          {arc?.usdcGas && (
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-resolve-muted">
              USDC gas · {arc.chain}
            </span>
          )}
          {arc?.stats.nanoPaymentsSettled ?
            <span className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-resolve-muted">
              {arc.stats.nanoPaymentsSettled} nano payments settled
            </span>
          : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-xs text-resolve-muted">
          <span>
            Network authorized:{" "}
            <Money amount={network?.authorizedUsd ?? 0} size="sm" className="inline" />
          </span>
          <span>
            Network claimable:{" "}
            <Money amount={network?.claimableUsd ?? 0} size="sm" className="inline" />
          </span>
          <span>
            Settled: <Money amount={network?.settledUsd ?? 0} size="sm" className="inline" />
          </span>
        </div>
      </section>

      {arc?.recentMemos && arc.recentMemos.length > 0 && (
        <section className="mb-8 border-b border-resolve-border pb-8">
          <p className="text-sm font-semibold text-white">Recent Arc memo settlements</p>
          <p className="mt-1 text-xs text-resolve-muted">
            Batch payouts with on-chain memo attribution — verified on Arcscan.
          </p>
          <ul className="mt-4 space-y-2">
            {arc.recentMemos.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between rounded-lg border border-white/[0.06] px-4 py-3"
              >
                <div>
                  <p className="text-sm text-white">{m.label}</p>
                  <a
                    href={`${arc.explorerUrl}/tx/${m.txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] text-resolve-accent hover:underline"
                  >
                    {m.txHash.slice(0, 10)}…{m.txHash.slice(-8)}
                  </a>
                </div>
                <Money amount={m.amountUsd} size="sm" className="text-white" />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-b border-resolve-border py-8">
        <CapitalCommunityPrograms />
      </section>

      {signedIn && account?.programs && account.programs.length > 0 && (
        <section className="border-b border-resolve-border py-8">
          <p className="text-sm font-semibold text-white">Your program wallets</p>
          <p className="mt-1 text-xs text-resolve-muted">
            Committed funds stay in your custody until contributors claim.
          </p>
          <ul className="mt-4 space-y-2">
            {account.programs.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg border border-white/[0.06] px-4 py-3"
              >
                <div>
                  <p className="text-sm font-medium text-white">{p.name}</p>
                  <p className="text-[11px] text-resolve-muted">
                    {p.communitySlug} · {p.status}
                  </p>
                </div>
                <div className="text-right text-xs text-resolve-muted">
                  <p>
                    Budget <Money amount={p.budgetUsd} size="sm" className="inline text-white" />
                  </p>
                  <p>
                    Committed{" "}
                    <Money amount={p.committedUsd} size="sm" className="inline text-white" />
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="border-b border-resolve-border py-8">
        <p className="text-sm font-semibold text-white">Pending</p>
        <p className="mt-3 text-sm text-resolve-muted">
          {signedIn && balances ?
            <>
              Your authorized:{" "}
              <Money amount={balances.earnedAuthorizedUsd} size="sm" className="inline" />
              {" · "}
              Your claimable: <Money amount={yourClaimable} size="sm" className="inline" />
            </>
          : <>
              Network authorized:{" "}
              <Money amount={network?.authorizedUsd ?? 0} size="sm" className="inline" />
            </>
          }
          {" · "}
          Awaiting deposit funding:{" "}
          <Money amount={network?.pendingFundingUsd ?? 0} size="sm" className="inline" />
        </p>
      </section>

      <section className="border-b border-resolve-border py-8">
        <p className="text-sm font-semibold text-white">Claims</p>
        {!signedIn ?
          <div className="mt-4 space-y-3">
            <p className="text-sm text-resolve-muted">Sign in to collect your earnings.</p>
            <Button onClick={onSignIn}>Sign in</Button>
          </div>
        : <>
            <p className="mt-3 text-lg font-medium text-white">
              <Money amount={yourClaimable} size="sm" className="inline" /> claimable for you
            </p>
            {!account?.identities?.github && (
              <p className="mt-1 text-xs text-amber-200/90">
                Link GitHub on Profile to match authorizations to your contributor identity.
              </p>
            )}
            {payoutWallet && (
              <p className="mt-2 flex items-center gap-1.5 font-mono text-xs text-resolve-muted">
                <Wallet className="h-3 w-3" />
                {payoutWallet.slice(0, 6)}…{payoutWallet.slice(-4)} — one wallet for your account
              </p>
            )}
            {currencyOptions.length > 0 && (
              <CurrencySelect
                value={payoutCurrency}
                options={currencyOptions}
                onChange={onPayoutCurrencyChange}
              />
            )}
            {fxHint && (
              <div className="mt-4">
                <FxSwapPanel hint={fxHint} />
              </div>
            )}
            <div className="mt-4">
              <Button
                onClick={onClaim}
                disabled={claiming || yourClaimable <= 0 || !payoutWallet}
              >
                {claiming ?
                  "Claiming via Arc memo…"
                : yourClaimable > 0 ?
                  "Claim to Arc wallet (batched)"
                : "Nothing to claim yet"}
              </Button>
            </div>
          </>
        }
      </section>

      <section className="border-b border-resolve-border py-8">
        <p className="text-sm font-semibold text-white">Account statement</p>
        <p className="mt-1 text-xs text-resolve-muted">
          Deposits and program reserves — same rails for every account size.
        </p>
        {initialLoading ?
          <p className="mt-3 text-sm text-resolve-muted">Loading…</p>
        : !account?.statement.length ?
          <p className="mt-3 text-sm text-resolve-muted">No account activity yet.</p>
        : <ul className="mt-4">
            {account.statement.map((line) => (
              <StatementRow key={line.id} line={line} />
            ))}
          </ul>
        }
      </section>

      <section className="py-8">
        <p className="text-sm font-semibold text-white">Settlement history</p>
        <p className="mt-1 text-xs text-resolve-muted">
          On-chain settlements show explorer verification — never optimistic paid state.
        </p>
        {initialLoading ?
          <p className="mt-3 text-sm text-resolve-muted">Loading…</p>
        : !settlements.length ?
          <p className="mt-3 text-sm text-resolve-muted">No settlements yet.</p>
        : <ul className="mt-4">
            {settlements.map((s) => (
              <CapitalSettlementRow
                key={s.id}
                label={s.label}
                amountUsd={s.amountUsd}
                txHash={s.txHash}
                status={s.status}
                at={s.at}
              />
            ))}
          </ul>
        }
      </section>
    </div>
  );
}
