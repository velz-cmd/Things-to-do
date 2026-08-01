export function buildPayoutOwnershipMessage(address: string, nonce: string) {
  return `RESOLVE payout destination\nAddress: ${address.toLowerCase()}\nNonce: ${nonce}`;
}
