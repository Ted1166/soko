# Architecture

```
                 browser (React, Vite)
                  |  HTTP + server-sent events
                  v
        server (Node, TypeScript, Express)
        - guest sessions and custodial keys
        - trader brain, rival, farm and customer simulation
        - radio desk (20 second calls)
                  |  JSON-RPC (near-api-js)
                  v
        NEAR testnet
        soko-market contract
        - ledger, listings, trades, policies
        - trader sub-accounts, each with one function-call key
```

## Contract (`contracts/soko-market`)

One contract holds all game state.

| File | Responsibility |
| --- | --- |
| `lib.rs` | State and `new` |
| `ledger.rs` | Coins and goods balances. The only place balances change. |
| `goods.rs` | Goods catalog and the reference price (clamped moving average inside a band around the base price) |
| `stall.rs` | `open_stall`, starter coins |
| `npc.rs` | `spawn_npc` and the owner-only controls |
| `policy.rs` | Policy validation and the checks run on every trader purchase |
| `market.rs` | Listings, repricing, cancelling and buying |
| `views.rs` | Read-only queries |
| `events.rs` | `EVENT_JSON` logs with standard `soko` |
| `admin.rs` | Seeding tools for the game admin |

Constants live in `constants.rs`: 8 traders per stall, 20 open listings per trader, 1,000 starter coins, 0.1 NEAR minimum to spawn a trader, 0.05 NEAR gas allowance per trader key.

`spawn_npc` creates the sub-account `<name>-<n>.<market account>`, funds it with the attached deposit, and adds one function-call key limited to `list_goods,reprice_listing,cancel_listing,buy_goods` on the market contract.

## Server (`server`)

| Path | Responsibility |
| --- | --- |
| `src/chain/near.ts` | RPC client. Serialises transactions per signer, retries only when a connection never opened, and rotates between RPC endpoints on network failures. |
| `src/chain/events.ts` | Parses `EVENT_JSON` logs and contract panic messages from transaction outcomes |
| `src/chain/keystore.ts` | Keys saved to `.data/keys.json` with mode 600 |
| `src/npc/brain.ts` | Pure function: given a trader's state and the market, returns buy and list actions that stay inside its policy |
| `src/npc/radio.ts` | The radio desk: opens calls, applies the player's decision or the default after 20 seconds |
| `src/npc/scheduler.ts` | Timers for traders, customers, rivals and the farm |
| `src/npc/pricing.ts` | Pure pricing rules for the farm, rivals and customer demand |
| `src/npc/llm.ts` | Optional language model for radio lines. Off by default. |
| `src/security/rogue.ts` | The compromised-trader test |
| `src/api/server.ts` | HTTP API and the event stream |
| `scripts/seed.ts` | Builds the town. Resumable. |
| `scripts/attack-demo.ts` | Terminal version of the attack test |

### API

| Method and path | Purpose |
| --- | --- |
| `POST /api/session` | Create a guest player and open a stall |
| `GET /api/state` | Prices, listings, the player's stall, traders and open radio calls |
| `POST /api/npcs` | Hire a trader |
| `POST /api/npcs/:account/fund`, `/defund` | Move coins to or from a trader |
| `POST /api/npcs/:account/freeze`, `/unfreeze` | Put a trader on hold or back to work |
| `PUT /api/npcs/:account/policy` | Change a trader's limits |
| `POST /api/npcs/:account/rogue-test` | Run the compromised-trader test. One run per trader every 45 seconds. |
| `POST /api/radio/:id/decide` | Answer a radio call with `match`, `hold` or `dump` |
| `GET /api/stream` | Server-sent events: `chain`, `radio_call`, `radio_update`, `npc_blocked` |

### The town

Everything below acts through the same contract methods a player's trader uses.

- **Farm** sells every good wholesale at 92% of the reference price, clamped to between half and double the base price.
- **Rivals** list below a player trader's price to trigger radio calls. They never go below 55% of the base price, and they raise cheap listings back toward the market.
- **Customers** buy the cheapest retail listing when it is below what their demand allows. Demand drifts and pulls back toward normal.
- **Traders** run `brain.ts` every 20 seconds.

### Radio call

1. A rival undercuts a trader's listing. The server opens a call with a 20 second window.
2. The client shows the call and the exact price each choice would set.
3. `match` reprices to the rival's price, `dump` to 85% of it, `hold` changes nothing.
4. If the window closes, the trader's personality default is applied: Mama Wanjiru holds, Juma matches, Otieno dumps.

The countdown on the client is measured on the client's own clock from the moment the call arrives, so clock differences between server and browser do not matter.

## Web client (`web`)

React 19 and Vite. `src/game.tsx` holds state: it polls `/api/state` every 8 seconds, listens to the event stream, and derives the activity feed at render time from the raw events and the latest state. `src/lib/story.ts` turns chain events into plain sentences. The interface shows coins, stalls and traders, and no wallet or gas terms.
