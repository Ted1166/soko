import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GameProvider, useGame } from "../src/game";
import type { Snapshot } from "../src/types";

type Listener = (event: MessageEvent) => void;

class FakeSource {
    static current: FakeSource | null = null;
    listeners = new Map<string, Listener[]>();
    onopen: (() => void) | null = null;
    onerror: (() => void) | null = null;

    constructor(readonly url: string) {
        FakeSource.current = this;
    }

    addEventListener(name: string, listener: Listener) {
        this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
    }

    emit(name: string, data: unknown) {
        for (const listener of this.listeners.get(name) ?? []) {
            listener({ data: JSON.stringify(data) } as MessageEvent);
        }
    }

    close() {
        return undefined;
    }
}

const OWNER = "p-abc.relay.testnet";
const NPC = "juma-2.market.testnet";

const snapshot: Snapshot = {
    now: Date.now(),
    owner: OWNER,
    stall: { owner: OWNER, name: "Mama Mboga", npcs: [NPC], coins: "388" },
    catalog: [{ id: "maize", name: "Maize", base_price: "40", reference_price: "31", volume: "1" }],
    listings: [],
    inventory: [],
    npcs: [
        {
            account: NPC,
            stall_owner: OWNER,
            name: "Juma",
            persona: "",
            policy: { max_trade_value: "500", daily_cap: "2000", max_premium_bps: 1000, allowed_goods: ["maize"] },
            spent_today: "0",
            active: true,
            coins: "412",
            inventory: [],
            archetype: "juma",
        },
    ],
    calls: [],
    netWorth: 800,
};

function Probe() {
    const { feed, blocks, snapshot: loaded } = useGame();
    const flags = feed.map((item) => `${item.text}|${item.mine ? "mine" : "town"}`);
    return (
        <div>
            <p data-testid="loaded">{loaded ? "yes" : "no"}</p>
            <ul>
                {feed.map((item, index) => (
                    <li key={item.id} data-flag={flags[index]}>
                        {item.text}
                    </li>
                ))}
            </ul>
            <ul>
                {blocks.map((item) => (
                    <li key={item.id}>{item.sentence}</li>
                ))}
            </ul>
        </div>
    );
}

let release: (() => void) | null = null;

beforeEach(() => {
    localStorage.setItem("soko.token", "demo");
    FakeSource.current = null;
    vi.stubGlobal("EventSource", FakeSource);
    vi.stubGlobal(
        "fetch",
        vi.fn(
            () =>
                new Promise<Response>((resolve) => {
                    release = () => resolve(new Response(JSON.stringify(snapshot), { status: 200 }));
                }),
        ),
    );
});

afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.unstubAllGlobals();
});

describe("GameProvider", () => {
    it("keeps stream events that arrive before the first state load", async () => {
        render(
            <GameProvider>
                <Probe />
            </GameProvider>,
        );
        await waitFor(() => expect(FakeSource.current).not.toBeNull());

        act(() => {
            FakeSource.current?.emit("chain", {
                event: "trade",
                data: { buyer: NPC, seller: "farm-1.relay.testnet", good: "maize", qty: "13", unit_price: "37", value: "481" },
            });
            FakeSource.current?.emit("npc_blocked", { npc: NPC, method: "buy_goods", reason: "Daily cap reached" });
        });
        expect(screen.getByTestId("loaded").textContent).toBe("no");

        await act(async () => {
            release?.();
        });

        await waitFor(() => expect(screen.getByTestId("loaded").textContent).toBe("yes"));
        expect(await screen.findByText("Juma bought 13 maize from Shamba Wholesale at 37")).toBeTruthy();
        expect(await screen.findByText("Juma hit today's spending limit")).toBeTruthy();
    });
});

describe("GameProvider ownership", () => {
    it("re-reads who owns a trade once the state learns about the trader", async () => {
        let current: Snapshot = { ...snapshot, npcs: [], stall: { ...snapshot.stall!, npcs: [] } };
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(JSON.stringify(current), { status: 200 })),
        );
        render(
            <GameProvider>
                <Probe />
            </GameProvider>,
        );
        await waitFor(() => expect(screen.getByTestId("loaded").textContent).toBe("yes"));

        act(() => {
            FakeSource.current?.emit("chain", {
                event: "trade",
                data: { buyer: "buyer1-x.relay.testnet", seller: NPC, good: "maize", qty: "2", unit_price: "22", value: "44" },
            });
        });
        const row = await screen.findByText(/bought 2 maize from Juma at 22/);
        expect(row.getAttribute("data-flag")).toMatch(/\|town$/);

        current = snapshot;
        await waitFor(
            () => expect(screen.getByText(/bought 2 maize from Juma at 22/).getAttribute("data-flag")).toMatch(/\|mine$/),
            { timeout: 5000 },
        );
    });
});

describe("GameProvider blocked events", () => {
    it("ignores infrastructure errors instead of listing them as stopped by a limit", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => new Response(JSON.stringify(snapshot), { status: 200 })),
        );
        render(
            <GameProvider>
                <Probe />
            </GameProvider>,
        );
        await waitFor(() => expect(screen.getByTestId("loaded").textContent).toBe("yes"));

        act(() => {
            FakeSource.current?.emit("npc_blocked", {
                npc: NPC,
                method: "buy_goods",
                reason: '{"jsonrpc": "2.0", "error": {"code": -429, "message": "Rate limits exceeded"}, "id": "1"}',
            });
            FakeSource.current?.emit("npc_blocked", { npc: NPC, method: "buy_goods", reason: "Daily cap reached" });
        });

        expect(await screen.findByText("Juma hit today's spending limit")).toBeTruthy();
        expect(screen.queryByText(/Rate limits exceeded/)).toBeNull();
    });
});
