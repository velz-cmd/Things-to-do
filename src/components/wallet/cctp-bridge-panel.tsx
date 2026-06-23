"use client";

import { useEffect, useState, useCallback } from "react";
import {
  useAccount,
  useWriteContract,
  useSwitchChain,
} from "wagmi";
import { parseUnits } from "viem";
import { toast } from "sonner";
import { useAuth } from "@/components/auth/auth-provider";
import clsx from "clsx";

type CctpConfig = {
  sourceChainId: number;
  destinationChainId: number;
  sourceDomain: number;
  destinationDomain: number;
  sepoliaUsdc: string;
  tokenMessenger: string;
  arcMessageTransmitter: string;
  attestationApi: string;
  faucetUrl: string;
};

const ERC20_ABI = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const BURN_ABI = [
  {
    type: "function",
    name: "depositForBurn",
    stateMutability: "nonpayable",
    inputs: [
      { name: "amount", type: "uint256" },
      { name: "destinationDomain", type: "uint32" },
      { name: "mintRecipient", type: "bytes32" },
      { name: "burnToken", type: "address" },
      { name: "destinationCaller", type: "bytes32" },
      { name: "maxFee", type: "uint256" },
      { name: "minFinalityThreshold", type: "uint32" },
    ],
    outputs: [],
  },
] as const;

const MINT_ABI = [
  {
    type: "function",
    name: "receiveMessage",
    stateMutability: "nonpayable",
    inputs: [
      { name: "message", type: "bytes" },
      { name: "attestation", type: "bytes" },
    ],
    outputs: [],
  },
] as const;

type Step = "idle" | "approve" | "burn" | "attest" | "mint" | "done";

export function CctpBridgePanel({
  amount,
  onSuccess,
}: {
  amount: number;
  onSuccess: () => void;
}) {
  const { address } = useAccount();
  const { refreshBalance } = useAuth();
  const { switchChainAsync } = useSwitchChain();
  const [config, setConfig] = useState<CctpConfig | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [burnTxHash, setBurnTxHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const { writeContractAsync } = useWriteContract();

  useEffect(() => {
    fetch("/api/bridge/cctp-config")
      .then((r) => r.json())
      .then(setConfig);
  }, []);

  const mintRecipient = address
    ? (`0x000000000000000000000000${address.slice(2)}` as `0x${string}`)
    : undefined;

  const runBridge = useCallback(async () => {
    if (!config || !address || !mintRecipient) {
      toast.error("Connect wallet on Sepolia first");
      return;
    }

    setLoading(true);
    const amountUnits = parseUnits(amount.toString(), 6);
    const maxFee = BigInt(500);

    try {
      await switchChainAsync({ chainId: config.sourceChainId });

      setStep("approve");
      await writeContractAsync({
        chainId: config.sourceChainId,
        address: config.sepoliaUsdc as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [config.tokenMessenger as `0x${string}`, amountUnits * BigInt(2)],
      });

      setStep("burn");
      const burnHash = await writeContractAsync({
        chainId: config.sourceChainId,
        address: config.tokenMessenger as `0x${string}`,
        abi: BURN_ABI,
        functionName: "depositForBurn",
        args: [
          amountUnits,
          config.destinationDomain,
          mintRecipient,
          config.sepoliaUsdc as `0x${string}`,
          "0x0000000000000000000000000000000000000000000000000000000000000000",
          maxFee,
          1000,
        ],
      });
      setBurnTxHash(burnHash);

      setStep("attest");
      const attestation = await pollAttestation(config.attestationApi, burnHash);

      setStep("mint");
      await switchChainAsync({ chainId: config.destinationChainId });
      const mintHash = await writeContractAsync({
        chainId: config.destinationChainId,
        address: config.arcMessageTransmitter as `0x${string}`,
        abi: MINT_ABI,
        functionName: "receiveMessage",
        args: [
          attestation.message as `0x${string}`,
          attestation.attestation as `0x${string}`,
        ],
      });

      const creditRes = await fetch("/api/bridge/cctp-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mintTxHash: mintHash, amountUsd: amount }),
      });
      const creditData = await creditRes.json();
      if (!creditRes.ok) throw new Error(creditData.error ?? "Could not credit balance");

      setStep("done");
      toast.success("USDC bridged to Arc", { description: creditData.message });
      await refreshBalance();
      onSuccess();
    } catch (e) {
      toast.error("Bridge failed", {
        description: e instanceof Error ? e.message : "Try again",
      });
      setStep("idle");
    } finally {
      setLoading(false);
    }
  }, [
    config,
    address,
    mintRecipient,
    amount,
    switchChainAsync,
    writeContractAsync,
    refreshBalance,
    onSuccess,
  ]);

  if (!config) {
    return <p className="text-sm text-resolve-muted">Loading bridge config…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-xs leading-relaxed text-resolve-muted">
        Bridge USDC from Ethereum Sepolia to Arc Testnet using Circle CCTP. Fund your
        task budget without buying crypto on Arc directly.
      </p>

      <div className="rounded-lg border border-white/[0.06] bg-black/20 px-3 py-2 text-xs text-resolve-muted">
        <p>Sepolia USDC → Arc USDC · Domain {config.sourceDomain} → {config.destinationDomain}</p>
        <a
          href={config.faucetUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-sky-400 hover:underline"
        >
          Get testnet USDC from Circle Faucet →
        </a>
      </div>

      {!address && (
        <p className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-100">
          Connect your wallet from the account menu, then switch to Sepolia to bridge.
        </p>
      )}

      {step !== "idle" && step !== "done" && (
        <div className="flex flex-wrap gap-2">
          {(["approve", "burn", "attest", "mint"] as const).map((s) => (
            <span
              key={s}
              className={clsx(
                "rounded-full px-2.5 py-0.5 text-[10px] font-medium capitalize",
                step === s
                  ? "bg-sky-500/20 text-sky-300"
                  : "bg-white/5 text-resolve-muted"
              )}
            >
              {s}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={loading || !address}
        onClick={() => void runBridge()}
        className="w-full rounded-xl bg-sky-500 py-3 text-sm font-semibold text-white hover:bg-sky-400 disabled:opacity-50"
      >
        {loading
          ? `Bridging $${amount}…`
          : `Bridge $${amount} USDC to Arc`}
      </button>

      {burnTxHash && (
        <p className="font-mono text-[10px] text-resolve-muted break-all">
          Burn tx: {burnTxHash}
        </p>
      )}
    </div>
  );
}

async function pollAttestation(
  apiBase: string,
  transactionHash: string
): Promise<{ message: string; attestation: string }> {
  const url = `${apiBase}?transactionHash=${transactionHash}`;
  for (let i = 0; i < 60; i++) {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const msg = data.messages?.[0];
      if (msg?.status === "complete") {
        return { message: msg.message, attestation: msg.attestation };
      }
    }
    await new Promise((r) => setTimeout(r, 5000));
  }
  throw new Error("Attestation timed out — try again in a minute");
}
