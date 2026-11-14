import { describe, expect, it } from "vitest";

import { coins, percent, sparkPoints, trend } from "../src/lib/format";
import { outcomes, priceFor } from "../src/lib/radio";
import { describe as tell, displayName, explainBlock } from "../src/lib/story";
import type { Npc } from "../src/types";

const npc: Npc = {
    account: "juma-2.soko-market-x.testnet",
    stall_owner: "p-abc.relay.testnet",
    name: "Juma",
    persona: "",
    policy: { max_trade_value: "500", daily_cap: "2000", max_premium_bps: 1000, allowed_goods: ["maize"] },
    spent_today: "0",
    active: true,
    coins: "600",
    inventory: [],
    archetype: "juma",
};

const context = { owner: "p-abc.relay.testnet", npcs: [npc], listings: [] };

describe("format", () => {
    it("formats coins with separators", () => {
        expect(coins(1234.4)).toBe("1,234 coins");
    });

    it("clamps percentages", () => {
        expect(percent(50, 200)).toBe(25);
        expect(percent(500, 200)).toBe(100);
        expect(percent(5, 0)).toBe(0);
    });

    it("reads a trend from a series", () => {
        expect(trend([20, 22, 25])).toBe("up");
        expect(trend([30, 22, 20])).toBe("down");
        expect(trend([20])).toBe("flat");
    });

    it("builds sparkline points only with enough data", () => {
        expect(sparkPoints([1], 64, 24)).toBe("");
        expect(sparkPoints([1, 2, 3], 64, 24).split(" ")).toHaveLength(3);
    });
});

describe("radio", () => {
    it("matches the server's pricing for each choice", () => {
        const call = { myPrice: 42, rivalPrice: 33 };
        expect(priceFor("match", call)).toBe(33);
        expect(priceFor("hold", call)).toBeNull();
        expect(priceFor("dump", call)).toBe(28);
    });

    it("describes each outcome in plain words", () => {
        const [match, hold, dump] = outcomes({ myPrice: 42, rivalPrice: 33 });
        expect(match.detail).toBe("Sell at 33");
        expect(hold.detail).toBe("Keep 42");
        expect(dump.detail).toBe("Sell at 28");
    });
});

describe("story", () => {
    it("names the player, their traders and the town", () => {
        expect(displayName("p-abc.relay.testnet", context)).toBe("You");
        expect(displayName(npc.account, context)).toBe("Juma");
        expect(displayName("farm-7e8135.relay.testnet", context)).toBe("Shamba Wholesale");
        expect(displayName("p-zzz.relay.testnet", context)).toBe("A neighbour");
    });

    it("tells a trade in plain words and flags it as mine", () => {
        const story = tell(
            {
                event: "trade",
                data: { buyer: npc.account, seller: "farm-7e8135.relay.testnet", good: "maize", qty: "13", unit_price: "37" },
            },
            context,
        );
        expect(story?.text).toBe("Juma bought 13 maize from Shamba Wholesale at 37");
        expect(story?.mine).toBe(true);
    });

    it("ignores admin-only events", () => {
        expect(tell({ event: "coins_minted", data: {} }, context)).toBeNull();
    });

    it("explains blocked reasons without contract jargon", () => {
        expect(explainBlock("Daily cap reached")).toBe("hit today's spending limit");
        expect(explainBlock("Price too far above market")).toBe("refused to pay far above the market price");
        expect(explainBlock("Something unexpected")).toBe("Something unexpected");
    });
});
