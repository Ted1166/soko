import { describe, expect, it } from "vitest";

import { priceFor, RadioDesk, templateText, undercutPct } from "../src/npc/radio.js";
import type { RadioCall } from "../src/npc/radio.js";

function makeDesk() {
    let clock = 1_000_000;
    const repriced: Array<{ npc: string; price: number }> = [];
    const changes: RadioCall[] = [];
    const desk = new RadioDesk(
        async (call, price) => {
            repriced.push({ npc: call.npc, price });
        },
        (call) => changes.push({ ...call }),
        { windowMs: 20_000, cooldownMs: 90_000 },
        () => clock,
    );
    return {
        desk,
        repriced,
        changes,
        advance: (ms: number) => {
            clock += ms;
        },
    };
}

const input = {
    owner: "mama.testnet",
    npc: "juma-1.market.testnet",
    npcName: "Juma",
    good: "maize",
    listingId: 7,
    myPrice: 50,
    rivalPrice: 30,
    text: "Match, hold or dump? 20s.",
    defaultDecision: "match" as const,
};

describe("radio pricing", () => {
    it("computes the undercut percentage", () => {
        expect(undercutPct(50, 30)).toBe(40);
        expect(undercutPct(50, 60)).toBe(0);
    });

    it("maps each decision to a price", () => {
        const call = { myPrice: 50, rivalPrice: 30 };
        expect(priceFor("match", call)).toBe(30);
        expect(priceFor("hold", call)).toBeNull();
        expect(priceFor("dump", call)).toBe(25);
    });

    it("writes the scripted line in the expected shape", () => {
        expect(templateText({ opening: "Eh, boss!", good: "maize", pct: 40, windowSeconds: 20 })).toBe(
            "Eh, boss! A rival undercut my maize by 40%. Match, hold or dump? 20s.",
        );
    });
});

describe("RadioDesk", () => {
    it("applies the player's decision", async () => {
        const { desk, repriced } = makeDesk();
        const call = desk.open(input)!;
        const done = await desk.decide(call.id, "match", "player");
        expect(done.status).toBe("decided");
        expect(repriced).toEqual([{ npc: input.npc, price: 30 }]);
    });

    it("fires the default after the window closes", async () => {
        const { desk, repriced, advance } = makeDesk();
        const call = desk.open(input)!;
        advance(19_000);
        await desk.sweep();
        expect(desk.get(call.id)?.status).toBe("open");
        advance(2_000);
        await desk.sweep();
        expect(desk.get(call.id)?.status).toBe("defaulted");
        expect(repriced).toEqual([{ npc: input.npc, price: 30 }]);
    });

    it("holds without touching the chain", async () => {
        const { desk, repriced } = makeDesk();
        const call = desk.open(input)!;
        const done = await desk.decide(call.id, "hold", "player");
        expect(done.resolution).toBe("Held the price");
        expect(repriced).toEqual([]);
    });

    it("resolves a call only once", async () => {
        const { desk } = makeDesk();
        const call = desk.open(input)!;
        await desk.decide(call.id, "hold", "player");
        await expect(desk.decide(call.id, "match", "player")).rejects.toThrow("already resolved");
    });

    it("does not stack calls for one NPC and respects the cooldown", async () => {
        const { desk, advance } = makeDesk();
        const first = desk.open(input)!;
        expect(desk.open(input)).toBeNull();
        await desk.decide(first.id, "hold", "player");
        expect(desk.open(input)).toBeNull();
        advance(91_000);
        expect(desk.open(input)).not.toBeNull();
    });

    it("reports a failed reprice instead of crashing", async () => {
        const desk = new RadioDesk(
            async () => {
                throw new Error("Listing not found");
            },
            () => undefined,
            { windowMs: 20_000, cooldownMs: 0 },
        );
        const call = desk.open(input)!;
        const done = await desk.decide(call.id, "match", "player");
        expect(done.resolution).toContain("Listing not found");
    });
});
