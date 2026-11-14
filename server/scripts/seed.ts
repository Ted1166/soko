import "../src/net.js";
import { KeyStore } from "../src/chain/keystone.js";
import { NearChain } from "../src/chain/near.js";
import { loadConfig } from "../src/config.js";
import { Store } from "../src/game/store.js";
import type { GoodView, StallView } from "../src/types.js";

const config = loadConfig();
if (!config.adminKey) {
    throw new Error("Set ADMIN_PRIVATE_KEY to the market account key before seeding");
}

const keys = new KeyStore(config.dataDir);
keys.setMemory(config.relayerAccount, config.relayerKey);
keys.setMemory(config.marketAccount, config.adminKey);
const chain = new NearChain(config.rpcUrls, config.marketAccount, config.relayerAccount, keys);
const store = new Store(config.dataDir);

async function ensureTrader(prefix: string, stallName: string): Promise<string> {
    const suffix = `.${config.relayerAccount}`;
    let account = keys
        .names()
        .find((name) => name.startsWith(`${prefix}-`) && name.endsWith(suffix));
    if (!account) {
        account = await chain.createFundedAccount(prefix, config.systemFundingNear);
        console.log(`created ${account}`);
    }
    const stall = await chain.view<StallView | null>("get_stall", { owner: account });
    if (!stall) {
        await chain.call(account, "open_stall", { name: stallName });
        console.log(`opened stall ${stallName}`);
    }
    return account;
}

async function ensureGoods(account: string, goods: GoodView[], target: number): Promise<void> {
    for (const good of goods) {
        const held = Number(await chain.view<string>("goods_of", { account, good: good.id }));
        if (held < target / 2) {
            await chain.call(config.marketAccount, "mint_goods", {
                to: account,
                good: good.id,
                qty: String(target),
            });
            console.log(`stocked ${good.id} for ${account}`);
        }
    }
}

async function ensureCoins(account: string, target: number): Promise<void> {
    const coins = Number(await chain.view<string>("coins_of", { account }));
    if (coins < target / 2) {
        await chain.call(config.marketAccount, "mint_coins", { to: account, amount: String(target) });
        console.log(`funded ${account} with ${target} coins`);
    }
}

async function main(): Promise<void> {
    if (store.system) {
        console.log("The town already exists:", JSON.stringify(store.system, null, 2));
        return;
    }
    const catalog = await chain.view<GoodView[]>("get_catalog");

    const farm = await ensureTrader("farm", "Shamba Wholesale");
    await ensureGoods(farm, catalog, 100_000);

    const rivals: string[] = [];
    for (const [index, name] of ["Baraka Traders", "Zawadi Stores"].entries()) {
        const rival = await ensureTrader(`rival${index + 1}`, name);
        await ensureGoods(rival, catalog, 5_000);
        rivals.push(rival);
    }

    const customers: string[] = [];
    for (const [index, name] of ["Soko Shoppers", "Mtaa Buyers", "Pwani Folk"].entries()) {
        const customer = await ensureTrader(`buyer${index + 1}`, name);
        await ensureCoins(customer, 1_000_000);
        customers.push(customer);
    }

    store.setSystem({ farm, rivals, customers });
    console.log("town ready");
}

main().catch((error) => {
    console.error(error);
    console.error("\nThe seed is safe to run again: it resumes from what already exists on-chain.");
    process.exit(1);
});
