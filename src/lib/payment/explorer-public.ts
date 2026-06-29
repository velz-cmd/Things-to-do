/** Client-safe Arc explorer base — mirrors server ARC_EXPLORER_URL when set. */
export const PUBLIC_ARC_EXPLORER_URL =
  process.env.NEXT_PUBLIC_ARC_EXPLORER_URL ?? "https://testnet.arcscan.app";

export function explorerUrlForTx(hash?: string | null): string | null {
  if (!hash?.match(/^0x[a-fA-F0-9]{64}$/)) return null;
  return `${PUBLIC_ARC_EXPLORER_URL}/tx/${hash}`;
}
