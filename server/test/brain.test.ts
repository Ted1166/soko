import { describe, expect, it } from "vitest";

import { decideNpcActions } from "../src/npc/brain.js";
import { ARCHETYPES } from "../src/npc/personalities.js";
import type { GoodView, ListingView, NpcView } from "../src/types.js";

const catalog: GoodView[] = [
    { id: "maize", name: "Maize", base_price: "40", reference_price: "40", volume: "0" },
    { id: "tea", name: "Tea", base_price: "70", reference_price: "70", volume: "0" },
];

function npc(overrides: Partial<NpcView> = {}): NpcView {
    return {
        account: "juma-1.market.testnet",
        stall_owner: "mama.testnet",
        name: "Juma",
        persona: "",
        policy: {
            max_trade_value: "500",
            daily_cap: "2000",
            max_premium_bps: 1000,
            allowed_goods: ["maize"],
        },
        spent_today: "0",
        active: true,
        coins: "600",
        inventory: [],
        ...overrides,
    };
}

function listing(id: number, seller: string, price: number, qty = 100): ListingView {
    return {
        id,
        seller,
        good: "maize",
        qty: String(qty),
        unit_price: String(price),
        listed_at: "0",
    };
}

describe("decideNpcActions", () => {
    it("buys from the cheapest acceptable seller", () => {
        const actions = decideNpcActions({
            npc: npc(),
            archetype: ARCHETYPES.juma,
            catalog,
            listings: [listing(1, "farm", 37), listing(2, "rival", 33)],
            blockedSellers: new Set(["mama.testnet"]),
        });
        expect(actions).toEqual([{ type: "buy", listingId: 2, good: "maize", qty: 15 }]);
    });

    it("never buys above the policy price ceiling", () => {
        const actions = decideNpcActions({
            npc: npc(),
            archetype: ARCHETYPES.juma,
            catalog,
            listings: [listing(1, "evil", 80)],
            blockedSellers: new Set(),
        });
        expect(actions).toEqual([]);
    });

    it("skips sellers it is not allowed to trade with", () => {
        const actions = decideNpcActions({
            npc: npc(),
            archetype: ARCHETYPES.juma,
            catalog,
            listings: [listing(1, "sibling.market.testnet", 30)],
            blockedSellers: new Set(["sibling.market.testnet"]),
        });
        expect(actions).toEqual([]);
    });

    it("limits the quantity by trade value, coins and daily cap", () => {
        const actions = decideNpcActions({
            npc: npc({
                coins: "100",
                spent_today: "1950",
                policy: {
                    max_trade_value: "500",
                    daily_cap: "2000",
                    max_premium_bps: 1000,
                    allowed_goods: ["maize"],
                },
            }),
            archetype: ARCHETYPES.juma,
            catalog,
            listings: [listing(1, "farm", 37)],
            blockedSellers: new Set(),
        });
        expect(actions).toEqual([{ type: "buy", listingId: 1, good: "maize", qty: 1 }]);
    });

    it("lists stock it holds at a markup over the reference price", () => {
        const actions = decideNpcActions({
            npc: npc({ inventory: [{ good: "maize", qty: "30" }], coins: "0" }),
            archetype: ARCHETYPES.juma,
            catalog,
            listings: [],
            blockedSellers: new Set(),
        });
        expect(actions).toEqual([{ type: "list", good: "maize", qty: 30, price: 43 }]);
    });

    it("does nothing while frozen", () => {
        const actions = decideNpcActions({
            npc: npc({ active: false }),
            archetype: ARCHETYPES.juma,
            catalog,
            listings: [listing(1, "farm", 37)],
            blockedSellers: new Set(),
        });
        expect(actions).toEqual([]);
    });

    it("ignores goods outside the policy", () => {
        const actions = decideNpcActions({
            npc: npc(),
            archetype: ARCHETYPES.juma,
            catalog,
            listings: [{ ...listing(1, "farm", 60), good: "tea" }],
            blockedSellers: new Set(),
        });
        expect(actions).toEqual([]);
    });
});
