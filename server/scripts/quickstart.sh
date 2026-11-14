#!/usr/bin/env bash
set -euo pipefail

API="${API:-http://localhost:8787}"

json() {
  node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const o=JSON.parse(d);if(o.error){console.error("Error: "+o.error);process.exit(1)}console.log(o[process.argv[1]])})' "$1"
}

echo "Opening a stall..."
SESSION="$(curl -sS -X POST "$API/api/session" -H 'content-type: application/json' -d '{"name":"Mama Mboga"}')"
TOKEN="$(echo "$SESSION" | json token)"
OWNER="$(echo "$SESSION" | json owner)"
echo "Player account: $OWNER"

echo "Hiring Juma..."
NPC="$(curl -sS -X POST "$API/api/npcs" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"name":"Juma","archetype":"juma","persona":"Quick with a deal"}' | json account)"
echo "NPC account: $NPC"

echo "Giving Juma 600 coins to trade with..."
curl -sS -X POST "$API/api/npcs/$NPC/fund" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' -d '{"amount":"600"}' >/dev/null

echo
echo "Ready. Watch the town live:"
echo "  curl -N \"$API/api/stream?token=$TOKEN\""
echo "See your state:"
echo "  curl -s \"$API/api/state\" -H \"authorization: Bearer $TOKEN\""
echo "Run the attack demo against Juma:"
echo "  npm run attack-demo -- $NPC"
echo "$TOKEN" > .data/last-token
