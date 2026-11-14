#!/usr/bin/env bash
set -euo pipefail

: "${MARKET_ACCOUNT:?Set MARKET_ACCOUNT to the contract account}"
: "${PLAYER_ACCOUNT:?Set PLAYER_ACCOUNT to a funded testnet account}"

NETWORK=testnet

send() {
  near contract call-function as-transaction "$MARKET_ACCOUNT" "$2" json-args "$3" \
    prepaid-gas '100.0 Tgas' attached-deposit "$4" sign-as "$1" \
    network-config "$NETWORK" sign-with-keychain send
}

view() {
  near contract call-function as-read-only "$MARKET_ACCOUNT" "$1" json-args "$2" \
    network-config "$NETWORK" now
}

KEYS="$(node -e '
const c = require("crypto");
const { publicKey, privateKey } = c.generateKeyPairSync("ed25519");
const pub = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
const seed = privateKey.export({ format: "der", type: "pkcs8" }).subarray(-32);
const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const b58 = (b) => {
  let n = BigInt("0x" + Buffer.from(b).toString("hex")), s = "";
  while (n > 0n) { s = A[Number(n % 58n)] + s; n /= 58n; }
  for (const x of b) { if (x === 0) s = "1" + s; else break; }
  return s;
};
console.log("ed25519:" + b58(pub));
console.log("ed25519:" + b58(Buffer.concat([seed, pub])));
')"
NPC_PUBLIC="$(echo "$KEYS" | sed -n 1p)"

echo "== catalog"
view get_catalog '{}'

echo "== open stall"
send "$PLAYER_ACCOUNT" open_stall '{"name":"Mama Mboga"}' '0 NEAR'

echo "== spawn NPC"
send "$PLAYER_ACCOUNT" spawn_npc "{\"name\":\"Juma\",\"persona\":\"Careful maize trader\",\"public_key\":\"$NPC_PUBLIC\",\"policy\":{\"max_trade_value\":\"100\",\"daily_cap\":\"200\",\"max_premium_bps\":1000,\"allowed_goods\":[\"maize\",\"rice\"]}}" '0.1 NEAR'

NPC_ACCOUNT="$(view get_stall "{\"owner\":\"$PLAYER_ACCOUNT\"}" | grep -o "juma-[0-9]*\.$MARKET_ACCOUNT" | head -n 1)"
echo "NPC account: $NPC_ACCOUNT"

echo "== NPC account and its keys"
near account view-account-summary "$NPC_ACCOUNT" network-config "$NETWORK" now
near account list-keys "$NPC_ACCOUNT" network-config "$NETWORK" now

echo "== fund NPC and read it back"
send "$PLAYER_ACCOUNT" fund_npc "{\"npc\":\"$NPC_ACCOUNT\",\"amount\":\"300\"}" '0 NEAR'
view get_npc "{\"account\":\"$NPC_ACCOUNT\"}"

echo "== list goods and cancel"
send "$MARKET_ACCOUNT" mint_goods "{\"to\":\"$PLAYER_ACCOUNT\",\"good\":\"maize\",\"qty\":\"50\"}" '0 NEAR'
send "$PLAYER_ACCOUNT" list_goods '{"good":"maize","qty":"50","unit_price":"40"}' '0 NEAR'
view get_listings '{}'
send "$PLAYER_ACCOUNT" cancel_listing '{"listing_id":1}' '0 NEAR'
view inventory_of "{\"account\":\"$PLAYER_ACCOUNT\"}"

echo "smoke test finished"
