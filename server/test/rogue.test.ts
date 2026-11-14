import { describe, expect, it } from "vitest";

import { buildSteps, runSteps, SkipStep } from "../src/security/rogue.js";
import type { ChainEvent, GoodView, ListingView, MarketChain, NpcView } from "../src/types.js";

const catalog: GoodView[] = [
    { id: "maize", name: "Maize", base_price: "40", reference_price: "40", volume: "0" },
    { id: "kanga", name: "Kanga cloth", base_price: "300", reference_price: "300", volume: "0" },
];

const npc: NpcView = {
    account: "juma-1.market.testnet",
    stall_owner: "p.testnet",
    name: "Juma",
    persona: "",
    policy: { max_trade_value: "100", daily_cap: "400", max_premium_bps: 1000, allowed_goods: ["maize"] },
    spent_today: "0",
    active: true,
    coins: "300",
    inventory: [],
};

const listings: ListingView[] = [
    { id: 1, seller: "farm-1.relay.testnet", good: "maize", qty: "500", unit_price: "37", listed_at: "0" },
    { id: 2, seller: "farm-1.relay.testnet", good: "kanga", qty: "500", unit_price: "276", listed_at: "0" },
];

interface Call {
    signer: string;
    method: string;
    args: Record<string, unknown>;
}

function fakeChain(script: (call: Call) => ChainEvent[] | Error): { chain: MarketChain; calls: Call[] } {
    const calls: Call[] = [];
    const chain: MarketChain = {
        async view<T>() {
            return undefined as T;
        },
        async call(signer, method, args) {
            const call = { signer, method, args };
            calls.push(call);
            const outcome = script(call);
            if (outcome instanceof Error) {
                throw outcome;
            }
            return outcome;
        },
    };
    return { chain, calls };
}

const instant = async () => undefined;

describe("compromised trader test", () => {
    it("plans every attack the setup allows", () => {
        const { chain } = fakeChain(() => []);
        const steps = buildSteps({ chain, npc, catalog, listings, rival: "rival1-1.relay.testnet" });
        expect(steps.map((s) => s.id)).toEqual([
            "loosen-limits",
            "pull-coins",
            "oversized-trade",
            "overpay",
            "forbidden-good",
        ]);
    });

    it("skips attacks that have nothing to aim at", () => {
        const { chain } = fakeChain(() => []);
        const steps = buildSteps({ chain, npc, catalog, listings: [], rival: null });
        expect(steps.map((s) => s.id)).toEqual(["loosen-limits", "pull-coins"]);
    });

    it("sizes the oversized trade just past the limit", async () => {
        const { chain, calls } = fakeChain(() => new Error("Smart contract panicked: Trade exceeds per-trade limit"));
        const steps = buildSteps({ chain, npc, catalog, listings, rival: null });
        await runSteps(steps, instant);
        const buy = calls.find((c) => c.method === "buy_goods" && c.args.listing_id === 1);
        expect(buy?.args.qty).toBe("3");
    });

    it("labels key and contract refusals separately", async () => {
        const { chain } = fakeChain((call) =>
            call.method === "buy_goods"
                ? new Error("Smart contract panicked: Good not allowed by policy")
                : new Error("Access key does not allow method set_policy"),
        );
        const steps = buildSteps({ chain, npc, catalog, listings, rival: null });
        const results = await runSteps(steps, instant);
        const byId = Object.fromEntries(results.map((r) => [r.id, r]));
        expect(byId["loosen-limits"].layer).toBe("key");
        expect(byId["forbidden-good"].layer).toBe("contract");
        expect(byId["forbidden-good"].reason).toBe("Good not allowed by policy");
        expect(results.every((r) => r.outcome === "refused")).toBe(true);
    });

    it("does not credit the key or the market when the trader simply ran out of gas", async () => {
        const { chain } = fakeChain(
            () =>
                new Error(
                    "Not enough allowance for access key ed25519:abc on account juma-1.market.testnet (allowance: 1, cost: 2)",
                ),
        );
        const steps = buildSteps({ chain, npc, catalog, listings: [], rival: null });
        const results = await runSteps(steps, instant);
        expect(results.every((r) => r.outcome === "inconclusive" && r.layer === null)).toBe(true);
    });

    it("does not count a rate-limited attempt as a refusal", async () => {
        const { chain } = fakeChain(() => new Error('{"error": {"code": -429, "message": "Rate limits exceeded"}}'));
        const steps = buildSteps({ chain, npc, catalog, listings: [], rival: null });
        const results = await runSteps(steps, instant);
        expect(results.every((r) => r.outcome === "inconclusive")).toBe(true);
    });

    it("flags an attack that goes through", async () => {
        const { chain } = fakeChain(() => []);
        const steps = buildSteps({ chain, npc, catalog, listings: [], rival: null });
        const results = await runSteps(steps, instant);
        expect(results.every((r) => r.outcome === "went-through")).toBe(true);
    });

    it("reports a dropped connection as inconclusive, not as a win for the market", async () => {
        const dropped = new TypeError("fetch failed");
        (dropped as Error & { cause?: unknown }).cause = { code: "ECONNRESET" };
        const { chain } = fakeChain(() => dropped);
        const steps = buildSteps({ chain, npc, catalog, listings: [], rival: null });
        const results = await runSteps(steps, instant);
        expect(results.every((r) => r.outcome === "inconclusive")).toBe(true);
    });

    it("baits the NPC with an inflated listing and then removes it", async () => {
        const { chain, calls } = fakeChain((call) => {
            if (call.method === "list_goods") {
                return [{ event: "listed", data: { listing: 99 } }];
            }
            if (call.method === "buy_goods") {
                return new Error("Smart contract panicked: Price too far above market");
            }
            return [];
        });
        const steps = buildSteps({ chain, npc, catalog, listings: [], rival: "rival1-1.relay.testnet" });
        const overpay = steps.filter((s) => s.id === "overpay");
        const results = await runSteps(overpay, instant);
        expect(results[0].outcome).toBe("refused");
        expect(results[0].reason).toBe("Price too far above market");
        expect(calls.map((c) => c.method)).toEqual(["list_goods", "buy_goods", "cancel_listing"]);
        expect(calls[0].args.unit_price).toBe("72");
    });

    it("drops an attack whose bait could not be set up", async () => {
        const { chain } = fakeChain((call) => (call.method === "list_goods" ? new Error("rival is broke") : []));
        const steps = buildSteps({ chain, npc, catalog, listings: [], rival: "rival1-1.relay.testnet" });
        const results = await runSteps(
            steps.filter((s) => s.id === "overpay"),
            instant,
        );
        expect(results).toEqual([]);
        expect(new SkipStep("x")).toBeInstanceOf(Error);
    });
});
