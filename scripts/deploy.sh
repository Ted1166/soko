#!/usr/bin/env bash
set -euo pipefail

: "${MARKET_ACCOUNT:?Set MARKET_ACCOUNT to the contract account, e.g. soko-market-yourname.testnet}"
OWNER_ACCOUNT="${OWNER_ACCOUNT:-$MARKET_ACCOUNT}"

cd "$(dirname "$0")/../contracts/soko-market"

cargo test
cargo near build non-reproducible-wasm

WASM="$(find target/near -name 'soko_market.wasm' | head -n 1)"
near deploy "$MARKET_ACCOUNT" "$WASM"

if [ "${SKIP_INIT:-0}" != "1" ]; then
  near call "$MARKET_ACCOUNT" new "{\"owner\": \"$OWNER_ACCOUNT\"}" --useAccount "$MARKET_ACCOUNT"
fi
