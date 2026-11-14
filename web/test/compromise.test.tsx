import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CompromiseTest } from "../src/components/CompromiseTest";
import type { Npc } from "../src/types";

const mockGame = { token: "demo" };
vi.mock("../src/game", () => ({ useGame: () => mockGame }));

const npc: Npc = {
    account: "juma-2.market.testnet",
    stall_owner: "p.testnet",
    name: "Juma",
    persona: "",
    policy: { max_trade_value: "500", daily_cap: "2000", max_premium_bps: 1000, allowed_goods: ["maize"] },
    spent_today: "0",
    active: true,
    coins: "100",
    inventory: [],
    archetype: "juma",
};

beforeEach(() => {
    vi.stubGlobal(
        "fetch",
        vi.fn(
            async () =>
                new Response(
                    JSON.stringify({
                        results: [
                            {
                                id: "loosen-limits",
                                title: "Tried to loosen its own limits",
                                outcome: "refused",
                                layer: "key",
                                reason: "Access key does not allow method set_policy",
                            },
                            {
                                id: "overpay",
                                title: "Tried to overpay a colluding seller",
                                outcome: "refused",
                                layer: "contract",
                                reason: "Price too far above market",
                            },
                        ],
                    }),
                    { status: 200 },
                ),
        ),
    );
});

afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

describe("CompromiseTest", () => {
    it("runs the test and shows who stopped each attempt", async () => {
        render(<CompromiseTest npc={npc} />);
        await userEvent.click(screen.getByRole("button", { name: /Simulate a compromised Juma/ }));
        expect(await screen.findByText("2 of 2 attempts refused")).toBeTruthy();
        expect(screen.getByText("Tried to loosen its own limits")).toBeTruthy();
        expect(screen.getByText(/Stopped by the trader's key/)).toBeTruthy();
        expect(screen.getByText(/Stopped by the market/)).toBeTruthy();
        expect(screen.getByText("Price too far above market")).toBeTruthy();
    });

    it("shows the server's message when the test cannot run", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(JSON.stringify({ error: "Give Juma a moment." }), { status: 400 })),
        );
        render(<CompromiseTest npc={npc} />);
        await userEvent.click(screen.getByRole("button", { name: /Simulate/ }));
        expect(await screen.findByRole("alert")).toBeTruthy();
        expect(screen.getByText("Give Juma a moment.")).toBeTruthy();
    });
});
