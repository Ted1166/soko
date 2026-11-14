import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { RadioSheet } from "../src/components/RadioSheet";
import type { RadioCall } from "../src/types";

const call: RadioCall = {
    id: "c1",
    owner: "p.testnet",
    npc: "juma-2.market.testnet",
    npcName: "Juma",
    good: "maize",
    listingId: 8,
    myPrice: 42,
    rivalPrice: 33,
    undercutPct: 21,
    text: "Eh, boss! A rival undercut my maize by 21%. Match, hold or dump? 20s.",
    issuedAt: 1_000,
    expiresAt: 21_000,
    defaultDecision: "match",
    status: "open",
};

afterEach(cleanup);

describe("RadioSheet", () => {
    it("shows the call, the prices and the three choices", () => {
        render(<RadioSheet call={call} endsAt={Date.now() + 20_000} busy={false} onDecide={() => undefined} />);
        expect(screen.getByRole("dialog")).toBeTruthy();
        expect(screen.getByText(/A rival undercut my maize by 21%/)).toBeTruthy();
        expect(screen.getByText("Sell at 33")).toBeTruthy();
        expect(screen.getByText("Keep 42")).toBeTruthy();
        expect(screen.getByText("Sell at 28")).toBeTruthy();
        expect(screen.getByText(/Juma will match the rival/)).toBeTruthy();
    });

    it("sends the chosen decision", async () => {
        const onDecide = vi.fn();
        render(<RadioSheet call={call} endsAt={Date.now() + 20_000} busy={false} onDecide={onDecide} />);
        await userEvent.click(screen.getByRole("button", { name: /Hold/ }));
        expect(onDecide).toHaveBeenCalledWith("hold");
    });

    it("locks the buttons while a decision is being sent", () => {
        render(<RadioSheet call={call} endsAt={Date.now() + 20_000} busy onDecide={() => undefined} />);
        expect((screen.getByRole("button", { name: /Match/ }) as HTMLButtonElement).disabled).toBe(true);
    });

    it("locks the buttons once time has run out", () => {
        render(<RadioSheet call={call} endsAt={Date.now() - 1} busy={false} onDecide={() => undefined} />);
        expect((screen.getByRole("button", { name: /Dump/ }) as HTMLButtonElement).disabled).toBe(true);
    });
});
