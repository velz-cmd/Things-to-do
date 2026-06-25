export type WalletLabel = {
  name: string | null;
  category: string | null;
  risk: string | null;
  chain: string | null;
  verified: boolean;
};

export function isWalletLabelsConfigured(): boolean {
  return Boolean(process.env.WALLET_LABELS_API_KEY?.trim());
}

/** Lookup wallet identity via WalletLabels.xyz */
export async function lookupWalletLabel(address: string): Promise<WalletLabel | null> {
  const apiKey = process.env.WALLET_LABELS_API_KEY?.trim();
  if (!apiKey) return null;

  const res = await fetch("https://api.walletlabels.xyz/v1/lookup", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ address }),
  });

  if (res.status === 404) return null;
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`WalletLabels HTTP ${res.status}: ${text.slice(0, 120)}`);
  }

  const data = (await res.json()) as {
    name?: string;
    category?: string;
    risk?: string;
    chain?: string;
    verified?: boolean;
  };

  return {
    name: data.name ?? null,
    category: data.category ?? null,
    risk: data.risk ?? null,
    chain: data.chain ?? null,
    verified: Boolean(data.verified),
  };
}
