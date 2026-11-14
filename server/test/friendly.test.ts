import { describe, expect, it } from "vitest";

import { friendlyError, isFundShort } from "../src/api/friendly.js";

const raw =
    "Not enough balance for soko-relay-vamos01.testnet (balance: 693275156937500000000000, cost: 1007607442456250000000000)";

describe("friendlyError", () => {
    it("hides raw yocto amounts", () => {
        expect(friendlyError(raw)).toBe("Not enough NEAR in soko-relay-vamos01.testnet to complete that.");
    });

    it("explains an exhausted allowance in plain words", () => {
        expect(friendlyError("Not enough allowance for access key ed25519:abc on account x (allowance: 1, cost: 2)")).toBe(
            "That trader has run out of gas.",
        );
    });

    it("leaves other messages alone", () => {
        expect(friendlyError("Daily cap reached")).toBe("Daily cap reached");
    });

    it("recognises a low guest fund", () => {
        expect(isFundShort(raw)).toBe(true);
        expect(isFundShort("Daily cap reached")).toBe(false);
    });
});
