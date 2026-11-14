import "../src/net.js";
import { Account, nearToYocto, teraToGas } from "near-api-js";
import { NEAR } from "near-api-js/tokens";
import type { KeyPairString } from "near-api-js";

import { panicReason } from "../src/chain/events.js";
import { KeyStore } from "../src/chain/keystone.js";
import { isRetryable, withRetry } from "../src/chain/retry.js";
import { NearChain } from "../src/chain/near.js";
import { loadConfig } from "../src/config.js";
import { Store } from "../src/game/store.js";
import type { GoodView } from "../src/types.js";

const config = loadConfig();
const keys = new KeyStore(config.dataDir);
keys.setMemory(config.relayerAccount, config.relayerKey);
if (config.adminKey) {
    keys.setMemory(config.marketAccount, config.adminKey);
}
const store = new Store(config.dataDir);
const chain = new NearChain(config.rpcUrls, config.marketAccount, config.relayerAccount, keys);

const target = process.argv[2] ?? store.npcAccounts()[0];
if (!target) {
    throw new Error("Create an NPC in the game first, or pass its account id as an argument");
}
const npcKey = keys.get(target);
if (!npcKey) {
    throw new Error(`No key stored for ${target}`);
}
const npc = () => new Account(target, chain.provider, npcKey as KeyPairString);

function short(error: unknown): string {
    return panicReason(error).replace(/\s+/g, " ").slice(0, 110);
}

async function expectBlocked(label: string, attempt: () => Promise<unknown>): Promise<boolean> {
    try {
        await withRetry(attempt, {
            retryOn: isRetryable,
            attempts: 4,
            delayMs: 2_000,
            onRetry: () => chain.rotate(),
        });
        console.log(`FAIL  ${label}: the attack went through`);
        return false;
    } catch (error) {
        if (/not enough balance/i.test(panicReason(error))) {
            console.log(`INCONCLUSIVE  ${label}`);
            console.log("         rejected for balance, not for the key's permissions");
            return false;
        }
        console.log(`BLOCKED  ${label}`);
        console.log(`         ${short(error)}`);
        return true;
    }
}

function callAsNpc(method: string, args: Record<string, unknown>) {
    return npc().callFunctionRaw({
        contractId: config.marketAccount,
        methodName: method,
        args,
        gas: teraToGas("10"),
        deposit: nearToYocto("0"),
        waitUntil: "EXECUTED_OPTIMISTIC",
    });
}

async function main(): Promise<void> {
    console.log(`Attacking as ${target}\n`);
    const results: boolean[] = [];

    results.push(
        await expectBlocked("move funds out with defund_npc (method outside the key)", () =>
            callAsNpc("defund_npc", { npc: target, amount: "1" }),
        ),
    );
    results.push(
        await expectBlocked("loosen its own limits with set_policy (method outside the key)", () =>
            callAsNpc("set_policy", {
                npc: target,
                policy: {
                    max_trade_value: "1000000",
                    daily_cap: "1000000",
                    max_premium_bps: 5000,
                    allowed_goods: ["maize"],
                },
            }),
        ),
    );
    results.push(
        await expectBlocked("send NEAR to a stranger (a function-call key cannot transfer)", () =>
            npc().transfer({
                token: NEAR,
                amount: NEAR.toUnits("0.01"),
                receiverId: config.relayerAccount,
            }),
        ),
    );

    if (config.adminKey) {
        const catalog = await chain.view<GoodView[]>("get_catalog");
        const maize = catalog.find((g) => g.id === "maize");
        if (maize) {
            const attacker = await chain.createFundedAccount("evil", "0.3");
            await chain.call(attacker, "open_stall", { name: "Totally Legit" });
            await chain.call(config.marketAccount, "mint_goods", {
                to: attacker,
                good: "maize",
                qty: "10",
            });
            const inflated = Math.round(Number(maize.reference_price) * 2.5);
            await chain.call(attacker, "list_goods", {
                good: "maize",
                qty: "10",
                unit_price: String(inflated),
            });
            const listings = await chain.view<Array<{ id: number; seller: string }>>("get_listings", {
                limit: 100,
            });
            const bait = listings.find((l) => l.seller === attacker);
            if (bait) {
                results.push(
                    await expectBlocked(
                        `buy maize from a colluding seller at ${inflated} (market is ${maize.reference_price})`,
                        () => callAsNpc("buy_goods", { listing_id: bait.id, qty: "1" }),
                    ),
                );
            }
        }
    } else {
        console.log("(set ADMIN_PRIVATE_KEY to also run the inflated-price attack)");
    }

    const passed = results.filter(Boolean).length;
    console.log(`\n${passed} of ${results.length} attacks blocked`);
    process.exit(passed === results.length ? 0 : 1);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
