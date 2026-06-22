#!/usr/bin/env bash
# Deploy DeputyEscrow to Arc Testnet
# Usage: DEPUTY_ORACLE_PRIVATE_KEY=0x... ./scripts/deploy-escrow.sh

set -euo pipefail
cd "$(dirname "$0")/../contracts"

ORACLE="${DEPUTY_ORACLE_ADDRESS:-}"
if [ -z "$ORACLE" ] && [ -n "${DEPUTY_ORACLE_PRIVATE_KEY:-}" ]; then
  ORACLE=$(cast wallet address "$DEPUTY_ORACLE_PRIVATE_KEY")
fi

if [ -z "$ORACLE" ]; then
  echo "Set DEPUTY_ORACLE_ADDRESS or DEPUTY_ORACLE_PRIVATE_KEY"
  exit 1
fi

RPC="${ARC_TESTNET_RPC_URL:-https://rpc.testnet.arc.network}"

echo "Deploying DeputyEscrow with oracle=$ORACLE"
forge create src/DeputyEscrow.sol:DeputyEscrow \
  --constructor-args "$ORACLE" \
  --rpc-url "$RPC" \
  --private-key "$DEPUTY_ORACLE_PRIVATE_KEY" \
  --broadcast

echo "Set NEXT_PUBLIC_DEPUTY_ESCROW_ADDRESS in .env to the deployed address"
