# soko-market

One contract holds the whole game economy: stalls, the goods ledger, listings, and the spending policy for every NPC.

## Test

```bash
cd contracts/soko-market
cargo test
```

## Deploy to testnet

```bash
export MARKET_ACCOUNT=soko-market-yourname.testnet
./scripts/deploy.sh
```

## How NPC spending is limited

Each NPC is a sub-account of the market contract. Its only key is a function-call key that can call four methods on the market contract and nothing else: `list_goods`, `reprice_listing`, `cancel_listing`, `buy_goods`.

A function-call key cannot move tokens, and its allowance only covers gas. The real spending limits live in `policy.rs` and are checked on every `buy_goods` call made by an NPC:

- the NPC must be active (the owner can freeze it at any time)
- the good must be on the NPC's allowed list
- the trade value must be within the per-trade limit
- the NPC's spend for the day must stay within the daily cap
- the unit price must not exceed the market reference price by more than the allowed premium

Owner-only methods (`set_policy`, `fund_npc`, `defund_npc`, `stock_npc`, `unstock_npc`, `freeze_npc`, `unfreeze_npc`) check the caller against the stall owner, so an NPC cannot loosen its own limits.

## Methods

| Method | Caller | Purpose |
| --- | --- | --- |
| `open_stall` | player | open a stall and receive starter coins |
| `spawn_npc` | stall owner | create an NPC sub-account with a scoped key and a policy |
| `fund_npc`, `defund_npc` | stall owner | move coins to or from an NPC |
| `stock_npc`, `unstock_npc` | stall owner | move goods to or from an NPC |
| `set_policy` | stall owner | replace an NPC's policy |
| `freeze_npc`, `unfreeze_npc` | stall owner | stop or resume an NPC |
| `list_goods`, `reprice_listing`, `cancel_listing` | player or NPC | manage listings |
| `buy_goods` | player or NPC | buy from a listing |
| `add_good`, `mint_coins`, `mint_goods` | game admin | seed the game world |

Views: `get_catalog`, `get_good`, `get_stall`, `get_stalls`, `get_npc`, `get_stall_npcs`, `get_listing`, `get_listings`, `coins_of`, `goods_of`, `inventory_of`.

Events are logged as `EVENT_JSON:{...}` with standard `soko`.
