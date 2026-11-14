import { describe, expect, it } from "vitest";

import { extractEvents, failureMessage, logsFromOutcome, panicReason } from "../src/chain/events.js";

describe("chain events", () => {
    it("parses soko events and ignores everything else", () => {
        const events = extractEvents([
            'EVENT_JSON:{"standard":"soko","version":"1.0.0","event":"trade","data":{"qty":"3"}}',
            'EVENT_JSON:{"standard":"other","version":"1.0.0","event":"trade","data":{}}',
            "EVENT_JSON:not json",
            "plain log line",
        ]);
        expect(events).toEqual([{ event: "trade", data: { qty: "3" } }]);
    });

    it("collects logs from every receipt", () => {
        const logs = logsFromOutcome({
            transaction_outcome: { outcome: { logs: ["a"] } },
            receipts_outcome: [{ outcome: { logs: ["b", "c"] } }, { outcome: { logs: [] } }],
        });
        expect(logs).toEqual(["a", "b", "c"]);
    });

    it("extracts the contract panic reason from a failed outcome", () => {
        const outcome = {
            status: {
                Failure: {
                    ActionError: {
                        kind: { FunctionCallError: { ExecutionError: "Smart contract panicked: Daily cap reached" } },
                    },
                },
            },
        };
        expect(failureMessage(outcome)).toBe("Daily cap reached");
        expect(failureMessage({ status: { SuccessValue: "" } })).toBeNull();
    });

    it("reads the panic reason out of an error", () => {
        expect(panicReason(new Error("blah Smart contract panicked: Price too far above market\n at x"))).toBe(
            "Price too far above market",
        );
    });
});
