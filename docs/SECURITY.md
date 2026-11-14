# Security model

Soko's claim: an AI trader can be given money without being given the keys to everything. This document says what that means, what enforces it, and where it stops.

## Three layers

1. **The key.** A trader's account has exactly one access key. The protocol itself rejects any call to a method outside `list_goods`, `reprice_listing`, `cancel_listing` and `buy_goods`, any call to another contract, and any transfer of tokens. Those rejections never reach the contract.
2. **The contract.** Calls the key does allow are still checked in `policy.rs` on every `buy_goods` made by a trader. The contract refuses the call if any rule fails.
3. **The owner.** Only the stall owner can change a trader's policy, move its coins or goods, or freeze it. The contract checks the caller against the stall owner, so a trader cannot loosen its own limits.

## Rules enforced on every trader purchase

| Rule | Refusal message |
| --- | --- |
| Trader must not be frozen | `NPC is frozen` |
| Good must be on the trader's allowed list | `Good not allowed by policy` |
| Trade value must not exceed the per-trade limit | `Trade exceeds per-trade limit` |
| Spend today must stay within the daily cap | `Daily cap reached` |
| Unit price must not exceed the market reference price by more than the allowed premium | `Price too far above market` |

The daily window is a UTC day computed from the block timestamp. A trader with no coins cannot spend, so the funded balance is also a hard ceiling.

## Threats and defences

| Threat | Defence | Where | Test |
| --- | --- | --- | --- |
| A hijacked trader drains its funds in one trade | Per-trade limit | `policy.rs` | `npc_cannot_exceed_the_trade_limit` |
| A hijacked trader drains its funds in many small trades | Daily cap | `policy.rs` | `npc_stops_at_the_daily_cap` |
| A trader overpays a colluding seller | Price ceiling against the reference price | `policy.rs` | `colluding_seller_cannot_extract_an_inflated_price` |
| A trader buys goods it was never meant to hold | Allowed-goods list | `policy.rs` | `npc_cannot_buy_a_good_outside_its_policy` |
| A trader rewrites its own limits | Method not in the key, and owner check in the contract | key, `npc.rs` | `npc_cannot_rewrite_its_own_policy` |
| A trader moves its coins out | Method not in the key, and owner check in the contract | key, `npc.rs` | `npc_cannot_move_its_own_funds` |
| A trader opens its own stall to escape its limits | Contract rejects stalls from NPC accounts | `stall.rs` | `npc_cannot_open_a_stall` |
| An attacker pumps the reference price, then lets a trader overpay | One trade moves the price by at most 5%, and prices stay between half and double the base price | `goods.rs` | `price_pump_moves_the_reference_slowly`, `the_reference_price_cannot_run_away_above_double_the_base` |
| A player washes trades through their own traders to move prices | The contract rejects trades between a player's own stall and traders | `market.rs` | `wash_trading_between_own_npcs_is_blocked` |
| The market account trades against its own escrow | The contract account cannot open a stall | `stall.rs` | `the_market_account_cannot_trade_against_its_own_escrow` |
| A trader is hijacked and the owner needs to stop it now | Freeze switch | `npc.rs` | `frozen_npc_cannot_trade` |
| Listing spam fills contract storage | At most 20 open listings per trader | `market.rs` | none yet |

## Prove it live

- In the app: **Limits**, then **Simulate a compromised trader**. The trader's own key tries five attacks and each result names the layer that refused it. Source: `server/src/security/rogue.ts`.
- From a terminal: `cd server && npm run attack-demo -- <trader account>`. It prints `BLOCKED` with the protocol's or the contract's reason, and counts a refusal for balance reasons as inconclusive so it cannot pass for the wrong reason.
- On the chain: `near account list-keys <trader account> network-config testnet now` shows one function-call key and no full-access key.

## Trust assumptions and known gaps

- **The server is custodial.** It holds the private keys of guest players and traders. A compromised server could sign as a trader, which is still bounded by that trader's policy and funded balance, or as a player, which could change a policy. A production version would use player-held keys with social login.
- **Admin mint.** The game admin can mint coins and goods. This is a seeding tool for the testnet game world.
- **Reference price is trade-driven.** It is clamped, not oracle-fed. Collusion between separate stalls can still move it slowly inside the band.
- **Gas allowance.** A function-call key's allowance pays only gas. When it runs out, the trader retires permanently. This is intentional: the account has no key that could recover it.
- **No audit.** This code has unit tests and live testnet checks, not an independent audit.
