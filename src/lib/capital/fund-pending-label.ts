/** Parse Circle transfer id embedded in wallet activity labels during pending Arc funds. */
export const CIRCLE_TX_LABEL_PREFIX = "circle_tx:";
export const STAKE_LABEL_PREFIX = "stake:";

export function circleTxIdFromActivityLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const idx = label.indexOf(CIRCLE_TX_LABEL_PREFIX);
  if (idx === -1) return null;
  const rest = label.slice(idx + CIRCLE_TX_LABEL_PREFIX.length);
  const id = rest.split(/\s*·\s*/)[0]?.trim();
  return id && id.length > 0 ? id : null;
}

export function stakeIdFromActivityLabel(label: string | null | undefined): string | null {
  if (!label) return null;
  const idx = label.indexOf(STAKE_LABEL_PREFIX);
  if (idx === -1) return null;
  const id = label.slice(idx + STAKE_LABEL_PREFIX.length).trim().split(/\s*·\s*/)[0];
  return id && id.length > 0 ? id : null;
}

export function activityLabelWithCircleTx(
  base: string,
  circleTransactionId: string,
  stakeId?: string,
): string {
  const parts = [`${base}`, `${CIRCLE_TX_LABEL_PREFIX}${circleTransactionId}`];
  if (stakeId) parts.push(`${STAKE_LABEL_PREFIX}${stakeId}`);
  return parts.join(" · ");
}
