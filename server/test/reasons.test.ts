import { describe, expect, it } from "vitest";

import { isPolicyRefusal } from "../src/security/reasons.js";

describe("policy refusals", () => {
    it("accepts the reasons the contract gives", () => {
        for (const reason of [
            "Daily cap reached",
            "Trade exceeds per-trade limit",
            "Price too far above market",
            "Good not allowed by policy",
            "NPC is frozen",
        ]) {
            expect(isPolicyRefusal(reason)).toBe(true);
        }
    });

    it("does not mistake infrastructure errors for a refusal", () => {
        expect(isPolicyRefusal('{"jsonrpc": "2.0", "error": {"code": -429, "message": "Rate limits exceeded"}}')).toBe(false);
        expect(isPolicyRefusal("fetch failed")).toBe(false);
    });
});
