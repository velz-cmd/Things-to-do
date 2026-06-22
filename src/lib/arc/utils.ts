import { keccak256, toBytes } from "viem";

export function taskRefFromId(taskId: string): `0x${string}` {
  return keccak256(toBytes(taskId));
}

export function usdcToWei(amountUsd: number): bigint {
  const [whole, frac = ""] = amountUsd.toFixed(6).split(".");
  const padded = (frac + "000000000000000000").slice(0, 18);
  return BigInt(whole + padded);
}
