import type { Config } from "../config.js";
import { panicReason } from "../chain/events.js";
import { isNetworkError } from "../chain/retry.js";
import type { EventHub } from "../events/hub.js";
import type { Store } from "../game/store.js";
import type {
    GoodView,
    ListingView,
    MarketChain,
    NpcView,
    StallView,
} from "../types.js";
import { decideNpcActions } from "./brain.js";
import type { Llm } from "./llm.js";
import { archetypeFor } from "./personalities.js";
import { farmTarget, nextDemand, relaxedPrice, rivalUndercut } from "./pricing.js";
import type { RadioDesk } from "./radio.js";
import { templateText } from "./radio.js";

export interface SchedulerDeps {
    chain: MarketChain;
    store: Store;
    hub: EventHub;
    desk: RadioDesk;
    llm: Llm;
    config: Config;
    log: (message: string) => void;
}

interface Snapshot {
    catalog: GoodView[];
    listings: ListingView[];
}

function pick<T>(items: T[]): T | undefined {
    return items[Math.floor(Math.random() * items.length)];
}

export class Scheduler {
    private timers: NodeJS.Timeout[] = [];
    private running = new Set<string>();
    private demand = new Map<string, number>();

    constructor(private readonly deps: SchedulerDeps) { }

    start(): void {
        const { config } = this.deps;
        this.every("npcs", config.npcTickMs, () => this.tickNpcs());
        this.every("customers", config.customerTickMs, () => this.tickCustomers());
        this.every("rivals", config.rivalTickMs, () => this.tickRivals());
        this.every("farm", config.farmTickMs, () => this.tickFarm());
        this.every("radio", 1_000, () => this.deps.desk.sweep());
        setTimeout(() => this.run("farm", () => this.tickFarm()), 1_000).unref();
        setTimeout(() => this.run("npcs", () => this.tickNpcs()), 15_000).unref();
    }

    stop(): void {
        for (const timer of this.timers) {
            clearInterval(timer);
        }
        this.timers = [];
    }

    private run(name: string, task: () => Promise<void>): void {
        if (this.running.has(name)) {
            return;
        }
        this.running.add(name);
        task()
            .catch((error) => this.deps.log(`${name} tick failed: ${panicReason(error)}`))
            .finally(() => this.running.delete(name));
    }

    private every(name: string, ms: number, task: () => Promise<void>): void {
        this.timers.push(setInterval(() => this.run(name, task), ms));
    }

    private async snapshot(): Promise<Snapshot> {
        const { chain } = this.deps;
        const [catalog, listings] = await Promise.all([
            chain.view<GoodView[]>("get_catalog"),
            chain.view<ListingView[]>("get_listings", { limit: 100 }),
        ]);
        return { catalog, listings };
    }

    private async act(
        signer: string,
        method: string,
        args: Record<string, unknown>,
        owner?: string,
    ): Promise<boolean> {
        const { chain, hub, log } = this.deps;
        for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
                hub.publishChain(await chain.call(signer, method, args, { gasTgas: 10 }));
                log(`${signer.split(".")[0]} ${method} ${JSON.stringify(args)}`);
                return true;
            } catch (error) {
                const reason = panicReason(error);
                if (isNetworkError(error)) {
                    log(`${signer.split(".")[0]} ${method} skipped: network hiccup`);
                    return false;
                }
                if (/not enough allowance/i.test(reason) && attempt < 3) {
                    await new Promise((resolve) => setTimeout(resolve, 4_000));
                    continue;
                }
                log(`${signer} ${method} blocked: ${reason}`);
                if (owner) {
                    hub.publishPrivate(owner, "npc_blocked", { npc: signer, method, reason });
                }
                return false;
            }
        }
        return false;
    }

    private async tickNpcs(): Promise<void> {
        const { chain, store } = this.deps;
        const accounts = store.npcAccounts();
        if (accounts.length === 0) {
            return;
        }
        const snapshot = await this.snapshot();
        const stalls = new Map<string, StallView | null>();
        for (const account of accounts) {
            const npc = await chain.view<NpcView | null>("get_npc", { account });
            if (!npc || !npc.active) {
                continue;
            }
            if (!stalls.has(npc.stall_owner)) {
                stalls.set(
                    npc.stall_owner,
                    await chain.view<StallView | null>("get_stall", { owner: npc.stall_owner }),
                );
            }
            const stall = stalls.get(npc.stall_owner);
            const blocked = new Set<string>([npc.stall_owner, ...(stall?.npcs ?? [])]);
            const actions = decideNpcActions({
                npc,
                archetype: archetypeFor(store.archetypeOf(account)),
                catalog: snapshot.catalog,
                listings: snapshot.listings,
                blockedSellers: blocked,
            });
            for (const action of actions) {
                await new Promise((resolve) => setTimeout(resolve, 3_000));
                if (action.type === "buy") {
                    await this.act(
                        account,
                        "buy_goods",
                        { listing_id: action.listingId, qty: String(action.qty) },
                        npc.stall_owner,
                    );
                } else {
                    await this.act(
                        account,
                        "list_goods",
                        {
                            good: action.good,
                            qty: String(action.qty),
                            unit_price: String(action.price),
                        },
                        npc.stall_owner,
                    );
                }
            }
        }
    }

    private async tickCustomers(): Promise<void> {
        const system = this.deps.store.system;
        if (!system) {
            return;
        }
        const snapshot = await this.snapshot();
        for (const good of snapshot.catalog) {
            this.demand.set(good.id, nextDemand(this.demand.get(good.id) ?? 1, Math.random()));
        }
        const customer = pick(system.customers);
        const good = pick(snapshot.catalog);
        if (!customer || !good) {
            return;
        }
        const demand = this.demand.get(good.id) ?? 1;
        const willingness = Number(good.reference_price) * demand * 1.25;
        const retail = snapshot.listings
            .filter(
                (l) =>
                    l.good === good.id &&
                    l.seller !== system.farm &&
                    l.seller !== customer &&
                    Number(l.unit_price) <= willingness,
            )
            .sort((a, b) => Number(a.unit_price) - Number(b.unit_price))[0];
        if (!retail) {
            return;
        }
        const qty = Math.min(Number(retail.qty), 1 + Math.floor(Math.random() * 5));
        await this.act(customer, "buy_goods", { listing_id: retail.id, qty: String(qty) });
    }

    private async tickRivals(): Promise<void> {
        const { store, desk, llm, config } = this.deps;
        const system = store.system;
        if (!system || store.npcAccounts().length === 0) {
            return;
        }
        const snapshot = await this.snapshot();
        const npcAccounts = new Set(store.npcAccounts());
        const targets = snapshot.listings.filter((l) => npcAccounts.has(l.seller));
        const target = pick(targets);
        const rival = pick(system.rivals);
        if (!target || !rival) {
            return;
        }
        for (const rivalAccount of system.rivals) {
            for (const own of snapshot.listings.filter((l) => l.seller === rivalAccount)) {
                const good = snapshot.catalog.find((g) => g.id === own.good);
                const raised = good ? relaxedPrice(Number(own.unit_price), Number(good.reference_price)) : null;
                if (raised) {
                    await this.act(rivalAccount, "reprice_listing", {
                        listing_id: own.id,
                        unit_price: String(raised),
                    });
                }
            }
        }
        const myPrice = Number(target.unit_price);
        const base = Number(snapshot.catalog.find((g) => g.id === target.good)?.base_price ?? myPrice);
        const rivalPrice = rivalUndercut(myPrice, base, Math.random());
        if (rivalPrice === null) {
            return;
        }
        const rivalOwn = snapshot.listings.find((l) => l.seller === rival && l.good === target.good);
        const placed = rivalOwn
            ? await this.act(rival, "reprice_listing", {
                listing_id: rivalOwn.id,
                unit_price: String(rivalPrice),
            })
            : await this.act(rival, "list_goods", {
                good: target.good,
                qty: "20",
                unit_price: String(rivalPrice),
            });
        if (!placed) {
            return;
        }
        const npc = await this.deps.chain.view<NpcView | null>("get_npc", { account: target.seller });
        if (!npc) {
            return;
        }
        const archetype = archetypeFor(store.archetypeOf(npc.account));
        const pct = Math.round(((myPrice - rivalPrice) / myPrice) * 100);
        const windowSeconds = Math.round(config.radioWindowMs / 1000);
        const narrated = await llm.narrate({
            archetype,
            npcName: npc.name,
            persona: npc.persona,
            good: target.good,
            pct,
            windowSeconds,
        });
        const text =
            narrated ??
            templateText({
                opening: pick(archetype.opening) ?? "Boss,",
                good: target.good,
                pct,
                windowSeconds,
            });
        const call = desk.open({
            owner: npc.stall_owner,
            npc: npc.account,
            npcName: npc.name,
            good: target.good,
            listingId: target.id,
            myPrice,
            rivalPrice,
            text,
            defaultDecision: archetype.defaultDecision,
        });
        if (!call) {
            return;
        }
    }

    private async tickFarm(): Promise<void> {
        const system = this.deps.store.system;
        if (!system) {
            return;
        }
        const snapshot = await this.snapshot();
        for (const good of snapshot.catalog) {
            const target = farmTarget(Number(good.reference_price), Number(good.base_price));
            const own = snapshot.listings.find((l) => l.seller === system.farm && l.good === good.id);
            if (!own) {
                await this.act(system.farm, "list_goods", {
                    good: good.id,
                    qty: "5000",
                    unit_price: String(target),
                });
                continue;
            }
            const drift = Math.abs(Number(own.unit_price) - target) / target;
            if (drift > 0.03) {
                await this.act(system.farm, "reprice_listing", {
                    listing_id: own.id,
                    unit_price: String(target),
                });
            }
        }
    }
}
