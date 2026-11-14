import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { NpcCard } from "../src/components/NpcCard";
import type { Good, Npc } from "../src/types";

const catalog: Good[] = [{ id: "maize", name: "Maize", base_price: "40", reference_price: "20", volume: "0" }];

function trader(overrides: Partial<Npc> = {}): Npc {
    return {
        account: "juma-2.market.testnet",
        stall_owner: "p.testnet",
        name: "Juma",
        persona: "",
        policy: { max_trade_value: "500", daily_cap: "2000", max_premium_bps: 1000, allowed_goods: ["maize"] },
        spent_today: "0",
        active: true,
        coins: "412",
        inventory: [],
        archetype: "juma",
        gasTrades: 300,
        ...overrides,
    };
}

const noop = async () => undefined;

afterEach(cleanup);

describe("NpcCard gas", () => {
    it("shows a healthy trader as working with its gas left", () => {
        render(<NpcCard npc={trader()} catalog={catalog} personality="Bold" onAddCoins={noop} onToggle={noop} onTakeBack={noop} />);
        expect(screen.getByText("Working")).toBeTruthy();
        expect(screen.getByText("about 300 trades")).toBeTruthy();
    });

    it("warns when a trader is close to retiring", () => {
        render(
            <NpcCard npc={trader({ gasTrades: 12 })} catalog={catalog} personality="Bold" onAddCoins={noop} onToggle={noop} onTakeBack={noop} />,
        );
        expect(screen.getByText("Retiring soon")).toBeTruthy();
    });

    it("explains a retired trader and lets the owner take the coins back", async () => {
        const onTakeBack = vi.fn(async () => undefined);
        render(
            <NpcCard npc={trader({ gasTrades: 0 })} catalog={catalog} personality="Bold" onAddCoins={noop} onToggle={noop} onTakeBack={onTakeBack} />,
        );
        expect(screen.getByText("Out of gas")).toBeTruthy();
        expect(screen.queryByRole("button", { name: /Add coins/ })).toBeNull();
        await userEvent.click(screen.getByRole("button", { name: /Take back 412 coins/ }));
        expect(onTakeBack).toHaveBeenCalledTimes(1);
    });

    it("does not claim anything when the gas level is unknown", () => {
        render(
            <NpcCard npc={trader({ gasTrades: null })} catalog={catalog} personality="Bold" onAddCoins={noop} onToggle={noop} onTakeBack={noop} />,
        );
        expect(screen.getByText("unknown")).toBeTruthy();
        expect(screen.getByText("Working")).toBeTruthy();
    });
});
