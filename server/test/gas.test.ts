import { describe, expect, it } from "vitest";

import { nearFromYocto, tradesLeft } from "../src/chain/gas.js";

describe("gas left", () => {
    it("reports nothing when the key has no allowance to read", () => {
        expect(tradesLeft(null)).toBeNull();
    });

    it("reports zero once the allowance cannot cover one prepaid call", () => {
        expect(tradesLeft(0.0108)).toBe(0);
        expect(tradesLeft(0)).toBe(0);
    });

    it("counts the trades left above the prepaid headroom", () => {
        expect(tradesLeft(0.2)).toBe(472);
        expect(tradesLeft(0.05)).toBe(97);
    });

    it("reads yocto amounts", () => {
        expect(nearFromYocto("10821318281206100000000")).toBeCloseTo(0.0108213, 6);
    });
});
