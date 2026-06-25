import {
  env,
  getArcExplorerUrl,
  getBlockscoutChainId,
  INTEGRATIONS,
} from "@/lib/integrations/config";

type TxReceiptResponse = {
  status: string;
  message: string;
  result?: { status?: string };
};

type TxResponse = {
  status: string;
  result?: {
    hash?: string;
    from?: string;
    to?: string;
    value?: string;
  };
};

function proApiBase(chainId: number): string {
  return `https://api.blockscout.com/v2/api?chain_id=${chainId}`;
}

function legacyExplorerBase(): string {
  const explorer = getArcExplorerUrl().replace(/\/$/, "");
  return `${explorer}/api`;
}

async function blockscoutGet<T>(
  module: string,
  action: string,
  params: Record<string, string>,
): Promise<T | null> {
  const chainId = getBlockscoutChainId();
  const apiKey = env("BLOCKSCOUT_API_KEY");

  const attempts: { url: string; headers?: HeadersInit }[] = [];

  if (apiKey) {
    const qs = new URLSearchParams({
      module,
      action,
      apikey: apiKey,
      ...params,
    });
    attempts.push({
      url: `${proApiBase(chainId)}&${qs}`,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    attempts.push({
      url: `https://api.blockscout.com/${chainId}/api?${qs}`,
      headers: { Authorization: `Bearer ${apiKey}` },
    });
  }

  const legacyQs = new URLSearchParams({ module, action, ...params });
  if (apiKey) legacyQs.set("apikey", apiKey);
  attempts.push({ url: `${legacyExplorerBase()}?${legacyQs}` });

  for (const { url, headers } of attempts) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", ...headers },
        next: { revalidate: 0 },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as T;
      return json;
    } catch {
      continue;
    }
  }
  return null;
}

/** Post-settlement tx verification — never used for contributor scoring. */
export async function verifyTransaction(txHash: string): Promise<{
  verified: boolean;
  explorerUrl: string;
  message: string;
  from?: string;
  to?: string;
}> {
  const explorerUrl = `${getArcExplorerUrl()}/tx/${txHash}`;
  const normalized = txHash.startsWith("0x") ? txHash : `0x${txHash}`;

  const receipt = await blockscoutGet<TxReceiptResponse>(
    "transaction",
    "gettxreceiptstatus",
    { txhash: normalized },
  );

  if (receipt?.result?.status === "1") {
    return { verified: true, explorerUrl, message: "Transaction confirmed on Arc" };
  }

  const tx = await blockscoutGet<TxResponse>("transaction", "gettransactionbyhash", {
    txhash: normalized,
  });
  if (tx?.result?.hash) {
    return {
      verified: true,
      explorerUrl,
      message: "Transaction found on Arc explorer",
      from: tx.result.from,
      to: tx.result.to,
    };
  }

  return {
    verified: false,
    explorerUrl,
    message: INTEGRATIONS.blockscout()
      ? "Transaction not found — may still be pending"
      : "Set BLOCKSCOUT_API_KEY for Pro API verification",
  };
}

export async function getAddressBalance(address: string): Promise<{
  balanceWei: string | null;
  message: string;
}> {
  const json = await blockscoutGet<{ result?: string }>("account", "balance", {
    address,
    tag: "latest",
  });
  if (json?.result) {
    return { balanceWei: json.result, message: "Balance fetched via Blockscout" };
  }
  return { balanceWei: null, message: "Balance lookup failed" };
}

export async function pingBlockscout(): Promise<{ ok: boolean; message: string }> {
  const chainId = getBlockscoutChainId();
  if (!INTEGRATIONS.blockscout()) {
    const legacy = `${legacyExplorerBase()}?module=block&action=eth_block_number`;
    try {
      const res = await fetch(legacy);
      if (res.ok) return { ok: true, message: "Arc explorer API (no Pro key)" };
    } catch {
      /* fall through */
    }
    return { ok: false, message: "BLOCKSCOUT_API_KEY not set and explorer unreachable" };
  }

  const apiKey = env("BLOCKSCOUT_API_KEY")!;
  try {
    const res = await fetch(
      `${proApiBase(chainId)}&module=block&action=eth_block_number&apikey=${apiKey}`,
      { headers: { Authorization: `Bearer ${apiKey}` } },
    );
    if (res.ok) {
      const json = (await res.json()) as { result?: string };
      return { ok: true, message: `Blockscout Pro connected · chain ${chainId} · block ${json.result ?? "—"}` };
    }
    return { ok: false, message: `Blockscout Pro HTTP ${res.status}` };
  } catch {
    return { ok: false, message: "Blockscout Pro unreachable" };
  }
}
