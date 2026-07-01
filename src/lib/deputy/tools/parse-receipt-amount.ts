/** Parse USD amounts from email snippets — no hardcoded demo values. */
export function parseUsdFromReceiptText(text: string): number | null {
  const patterns = [
    /\$\s*([\d,]+(?:\.\d{2})?)/,
    /USD\s*([\d,]+(?:\.\d{2})?)/i,
    /([\d,]+\.\d{2})\s*USD/i,
    /total[:\s]+([\d,]+(?:\.\d{2})?)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const value = Number.parseFloat(match[1].replace(/,/g, ""));
    if (Number.isFinite(value) && value > 0 && value < 1_000_000) {
      return Math.round(value * 100) / 100;
    }
  }
  return null;
}
