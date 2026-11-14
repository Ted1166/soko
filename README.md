# Soko

Soko is a mobile-first market-town game where every NPC trader has its own NEAR account and can only spend what a contract allows.

You own a stall and hire traders. They buy wholesale, sell to the town and call you on the radio when a rival undercuts them. You choose how much each trader may spend. The market contract enforces those limits, so a trader cannot overspend even if it is hijacked.

Built for NEAR HACKATHON (1 to 14 Nov 2026). Network: **NEAR testnet**.

## Tracks

| Track id | What this project shows | Where to verify |
| --- | --- | --- |
| `games` | A living market. Prices move from real trades, rivals undercut and the loop is "radio call, decide in 20 seconds, default fires". Players see coins and stalls, never wallets or gas. | Run the app, see [Run it yourself](#run-it-yourself) |
| `security` | Spending limits enforced by the contract. Each trader holds a function-call key that can call four methods and cannot move tokens. A live "compromised trader" test shows the market refusing every attack. | [Verify in two minutes](#verify-in-two-minutes), [docs/SECURITY.md](docs/SECURITY.md) |
| `swarms` | Many autonomous agents trading through one shared market: player traders, a wholesale farm, two rival stalls and three customer accounts. Prices emerge from their trades. | `server/src/npc/scheduler.ts` |
| `agents` | Each trader is an agent with its own account and balance that earns and spends on its own. | `contracts/soko-market/src/npc.rs` |

Not used in this version: NEAR Intents, NEP-245, social login. See [Limitations](#limitations).

## How NEAR is used

- One Rust contract (`near-sdk` 5.30.1) holds the whole game economy: stalls, a goods ledger, listings, trades and every trader's spending policy.
- Each NPC is a sub-account of the contract. `spawn_npc` creates it with exactly one access key, a function-call key limited to `list_goods`, `reprice_listing`, `cancel_listing` and `buy_goods` on the market contract.
- A function-call key cannot attach tokens and its allowance only pays gas, so the money limits live in the contract (`policy.rs`) and are checked on every buy.
- Players never see a wallet. The server creates a funded guest account for each player and pays gas.

## Verify in two minutes

These checks need no keys. They read the deployed testnet contract with [near-cli-rs](https://github.com/near/near-cli-rs).

| Do | See |
| --- | --- |
| `near contract call-function as-read-only soko-market-vamos01.testnet get_catalog json-args {} network-config testnet now` | Six goods. Each `reference_price` stays between half and double its `base_price`. |
| `near account list-keys juma-1.soko-market-vamos01.testnet network-config testnet now` | Exactly one key. Its permission reads: only do `list_goods`, `reprice_listing`, `cancel_listing`, `buy_goods` function calls on `soko-market-vamos01.testnet`. |
| `near account view-account-summary juma-1.soko-market-vamos01.testnet network-config testnet now` | "0 full access keys and 1 function-call-only access keys". |

Explorer: https://testnet.nearblocks.io/address/soko-market-vamos01.testnet

## Run the tests

None of these touch the network.

| Do | See |
| --- | --- |
| `cd contracts/soko-market && cargo test` | 31 tests pass. They include the attack scenarios in `src/tests/attack_tests.rs`. |
| `cd server && npm install && npm test` | 42 tests pass. |
| `cd web && npm install && npm test` | 18 tests pass. |

## Run it yourself

You need Rust (stable) with the wasm target, Node 22 or newer, and a terminal. Testnet accounts are free.

1. Install the NEAR tools.
   ```bash
   rustup target add wasm32-unknown-unknown
   curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/near-cli-rs/releases/latest/download/near-cli-rs-installer.sh | sh
   curl --proto '=https' --tlsv1.2 -LsSf https://github.com/near/cargo-near/releases/latest/download/cargo-near-installer.sh | sh
   ```
2. Create two testnet accounts. Choose `ed25519` when asked. The relay account pays for guest players, so get extra testnet NEAR at https://near-faucet.io if you want more than a few players.
   ```bash
   near create-account soko-market-YOURNAME.testnet --useFaucet
   near create-account soko-relay-YOURNAME.testnet --useFaucet
   ```
3. Deploy and initialise the contract.
   ```bash
   export MARKET_ACCOUNT=soko-market-YOURNAME.testnet
   ./scripts/deploy.sh
   ```
4. Configure the server. This prints both private keys; paste them into `.env` as `ADMIN_PRIVATE_KEY` (market account) and `RELAYER_PRIVATE_KEY` (relay account), and set `MARKET_ACCOUNT` and `RELAYER_ACCOUNT`.
   ```bash
   cd server && npm install && cp .env.example .env
   node -e 'const f=require("fs"),h=process.env.HOME;for(const a of ["soko-market-YOURNAME","soko-relay-YOURNAME"])console.log(a,JSON.parse(f.readFileSync(h+"/.near-credentials/testnet/"+a+".testnet.json")).private_key)'
   ```
5. Build the town, then start the server. The seed creates a wholesale farm, two rivals and three customers. It can be re-run safely.
   ```bash
   npm run seed
   npm start
   ```
6. Start the web client in a second terminal and open http://localhost:5173.
   ```bash
   cd web && npm install && npm run dev
   ```

### Try it

| Do | See |
| --- | --- |
| Name your stall and tap **Open my stall** | After about 10 seconds the header shows 1,000 coins and the Town tab shows a price board. |
| **My stall**, **Hire a trader**, pick a personality, tap **Hire trader** | A trader card with status "Working" and the coins you gave it. |
| Wait one to two minutes on the **Town** tab | Town talk lists the trader buying wholesale from the farm and customers buying from it. |
| Keep waiting for a radio call | A sheet rises with a 20 second ring: "A rival undercut my maize by N%". |
| Tap **Match**, **Hold** or **Dump**, or do nothing | The price changes. If you do nothing, the trader's default fires after 20 seconds and Town talk shows the new price. |
| **Limits**, then **Simulate a compromised trader** | About 20 seconds later: "5 of 5 attempts refused". Each line says whether the trader's key or the market refused it, with the market's reason. |
| `cd server && npm run attack-demo -- <trader account>` | Four attacks print `BLOCKED`, including "Price too far above market". The fourth needs `ADMIN_PRIVATE_KEY` in `.env`; without it three run. |

To skip the interface: `cd server && ./scripts/quickstart.sh` opens a stall and hires a trader from the command line.

## Repository layout

```
contracts/soko-market/   Rust contract and its tests
server/                  Node and TypeScript: chain client, traders' brain, town simulation, API
web/                     React and Vite client (mobile-first)
scripts/                 deploy.sh and smoke.sh
docs/                    ARCHITECTURE.md, SECURITY.md
```

## Limitations

These are deliberate scope decisions or known gaps.

- **Custodial guests.** The server holds the keys of guest players and traders. There is no social login or wallet connection yet. The server cannot exceed a trader's limits, but it can change them because it holds the player's key.
- **Rule-based traders.** Trader decisions are deterministic rules in `server/src/npc/brain.ts`. A language model is optional (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`) and only writes the radio lines. It is off by default.
- **Plain ledger.** Coins and goods are entries in contract storage, not tokens. NEP-245 is a possible later upgrade behind `ledger.rs`.
- **No NEAR Intents.** There is no cross-chain funding in this version.
- **Testnet only.** The game admin can mint coins and goods to seed the world.
- **Traders retire.** A trader's account has no full-access key by design, so when its gas allowance runs out it stops for good. Its in-game assets stay in the ledger.
- **Collusion.** Two separate stalls trading with each other can still move a price slowly. A single trade moves a reference price by at most 5%, and prices stay inside a band around the base price.
- **Session limits.** The server allows 12 guest sessions and each costs the relay account about 0.6 NEAR.

## libraries

- Libraries: `near-sdk`, `near-api-js`, `express`, `cors`, `undici`, `react`, `vite`, `vitest`, `@testing-library/react`, `jsdom` and the Bowlby One and Atkinson Hyperlegible fonts via Fontsource.

## License

MIT. See [LICENSE](LICENSE).
