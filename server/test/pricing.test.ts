import { describe, expect, it } from "vitest";

import { farmTarget, nextDemand, relaxedPrice, rivalFloor, rivalUndercut } from "../src/npc/pricing.js";

describe("pricing", () => {
    it("prices the farm just under the market", () => {
        expect(farmTarget(40, 40)).toBe(37);
    });

    it("stops the farm from chasing a collapsing market below its floor", () => {
        expect(farmTarget(10, 40)).toBe(18);
        expect(farmTarget(1, 40)).toBe(18);
    });

    it("stops the farm from following a runaway market above its ceiling", () => {
        expect(farmTarget(500, 40)).toBe(74);
    });

    it("undercuts a rival listing but never below the floor", () => {
        expect(rivalUndercut(42, 40, 0.5)).toBe(34);
        expect(rivalFloor(40)).toBe(22);
        expect(rivalUndercut(23, 40, 0)).toBe(22);
    });

    it("does not undercut once the target is already at the floor", () => {
        expect(rivalUndercut(22, 40, 0.5)).toBeNull();
        expect(rivalUndercut(20, 40, 0.5)).toBeNull();
    });

    it("raises a cheap listing back toward the market gradually", () => {
        expect(relaxedPrice(18, 38)).toBe(22);
        expect(relaxedPrice(35, 38)).toBeNull();
        expect(relaxedPrice(1, 38)).toBe(2);
    });

    it("pulls demand back toward normal", () => {
        expect(nextDemand(1.4, 0.5)).toBeLessThan(1.4);
        expect(nextDemand(0.75, 0.5)).toBeGreaterThan(0.75);
        expect(nextDemand(1.5, 1)).toBeLessThanOrEqual(1.5);
    });
});
