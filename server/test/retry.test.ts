import { describe, expect, it } from "vitest";

import { isConnectError, isNetworkError, isRateLimit, isRetryable, withRetry } from "../src/chain/retry.js";

function connectTimeout(): Error {
    const error = new TypeError("fetch failed");
    (error as Error & { cause?: unknown }).cause = { code: "UND_ERR_CONNECT_TIMEOUT" };
    return error;
}

describe("retry", () => {
    it("recognises a connect timeout nested in a fetch error", () => {
        expect(isConnectError(connectTimeout())).toBe(true);
        expect(isConnectError(new Error("Smart contract panicked: Daily cap reached"))).toBe(false);
    });

    it("treats a bare fetch failure as a network error but not as a safe-to-resend one", () => {
        const bare = new TypeError("fetch failed");
        expect(isNetworkError(bare)).toBe(true);
        expect(isConnectError(bare)).toBe(false);
    });

    it("treats a connection reset as a network error but not a safe-to-resend one", () => {
        const reset = new TypeError("fetch failed");
        (reset as Error & { cause?: unknown }).cause = { code: "ECONNRESET" };
        expect(isNetworkError(reset)).toBe(true);
        expect(isConnectError(reset)).toBe(false);
    });

    it("recognises a rate limit from the public RPC", () => {
        const limited = new Error(
            'Rate limits exceeded. {"jsonrpc": "2.0", "error": {"code": -429, "message": "Rate limits exceeded. For higher rate limits get a subscription at https://fastnear.com"}, "id": "1"}',
        );
        expect(isRateLimit(limited)).toBe(true);
        expect(isRetryable(limited)).toBe(true);
        expect(isRateLimit(new Error("Smart contract panicked: Daily cap reached"))).toBe(false);
        expect(isRetryable(new Error("Smart contract panicked: Daily cap reached"))).toBe(false);
    });

    it("retries until the task succeeds", async () => {
        let calls = 0;
        const value = await withRetry(
            async () => {
                calls += 1;
                if (calls < 3) {
                    throw connectTimeout();
                }
                return "ok";
            },
            { retryOn: isConnectError, delayMs: 0 },
        );
        expect(value).toBe("ok");
        expect(calls).toBe(3);
    });

    it("gives up after the attempt limit", async () => {
        let calls = 0;
        await expect(
            withRetry(
                async () => {
                    calls += 1;
                    throw connectTimeout();
                },
                { retryOn: isConnectError, attempts: 3, delayMs: 0 },
            ),
        ).rejects.toThrow("fetch failed");
        expect(calls).toBe(3);
    });

    it("does not retry errors it should not resend", async () => {
        let calls = 0;
        await expect(
            withRetry(
                async () => {
                    calls += 1;
                    throw new Error("Smart contract panicked: Not enough coins");
                },
                { retryOn: isConnectError, delayMs: 0 },
            ),
        ).rejects.toThrow("Not enough coins");
        expect(calls).toBe(1);
    });
});
