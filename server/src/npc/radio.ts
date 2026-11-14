import { randomUUID } from "node:crypto";

import type { Decision } from "../types.js";

export interface RadioCall {
    id: string;
    owner: string;
    npc: string;
    npcName: string;
    good: string;
    listingId: number;
    myPrice: number;
    rivalPrice: number;
    undercutPct: number;
    text: string;
    issuedAt: number;
    expiresAt: number;
    defaultDecision: Decision;
    status: "open" | "decided" | "defaulted";
    decision?: Decision;
    newPrice?: number;
    resolution?: string;
}

export interface OpenInput {
    owner: string;
    npc: string;
    npcName: string;
    good: string;
    listingId: number;
    myPrice: number;
    rivalPrice: number;
    text: string;
    defaultDecision: Decision;
}

export type Executor = (call: RadioCall, newPrice: number) => Promise<void>;

export interface DeskOptions {
    windowMs: number;
    cooldownMs: number;
}

export function undercutPct(myPrice: number, rivalPrice: number): number {
    if (myPrice <= 0 || rivalPrice >= myPrice) {
        return 0;
    }
    return Math.round(((myPrice - rivalPrice) / myPrice) * 100);
}

export function priceFor(decision: Decision, call: Pick<RadioCall, "rivalPrice" | "myPrice">): number | null {
    if (decision === "hold") {
        return null;
    }
    if (decision === "match") {
        return Math.max(1, call.rivalPrice);
    }
    return Math.max(1, Math.floor(call.rivalPrice * 0.85));
}

export function templateText(input: {
    opening: string;
    good: string;
    pct: number;
    windowSeconds: number;
}): string {
    return `${input.opening} A rival undercut my ${input.good} by ${input.pct}%. Match, hold or dump? ${input.windowSeconds}s.`;
}

export class RadioDesk {
    private readonly calls = new Map<string, RadioCall>();
    private readonly cooldownUntil = new Map<string, number>();

    constructor(
        private readonly executor: Executor,
        private readonly onChange: (call: RadioCall) => void,
        private readonly options: DeskOptions,
        private readonly now: () => number = () => Date.now(),
    ) { }

    open(input: OpenInput): RadioCall | null {
        const now = this.now();
        if ((this.cooldownUntil.get(input.npc) ?? 0) > now) {
            return null;
        }
        for (const call of this.calls.values()) {
            if (call.npc === input.npc && call.status === "open") {
                return null;
            }
        }
        const call: RadioCall = {
            id: randomUUID(),
            owner: input.owner,
            npc: input.npc,
            npcName: input.npcName,
            good: input.good,
            listingId: input.listingId,
            myPrice: input.myPrice,
            rivalPrice: input.rivalPrice,
            undercutPct: undercutPct(input.myPrice, input.rivalPrice),
            text: input.text,
            issuedAt: now,
            expiresAt: now + this.options.windowMs,
            defaultDecision: input.defaultDecision,
            status: "open",
        };
        this.calls.set(call.id, call);
        this.onChange(call);
        return call;
    }

    get(id: string): RadioCall | undefined {
        return this.calls.get(id);
    }

    openFor(owner: string): RadioCall[] {
        return [...this.calls.values()].filter((c) => c.owner === owner && c.status === "open");
    }

    async decide(id: string, decision: Decision, by: "player" | "default"): Promise<RadioCall> {
        const call = this.calls.get(id);
        if (!call) {
            throw new Error("Radio call not found");
        }
        if (call.status !== "open") {
            throw new Error("Radio call already resolved");
        }
        call.status = by === "player" ? "decided" : "defaulted";
        call.decision = decision;
        this.cooldownUntil.set(call.npc, this.now() + this.options.cooldownMs);
        const price = priceFor(decision, call);
        if (price === null) {
            call.resolution = "Held the price";
        } else {
            call.newPrice = price;
            try {
                await this.executor(call, price);
                call.resolution = `Repriced to ${price}`;
            } catch (error) {
                call.resolution = `Could not reprice: ${error instanceof Error ? error.message : String(error)}`;
            }
        }
        this.onChange(call);
        return call;
    }

    async sweep(): Promise<void> {
        const now = this.now();
        const due = [...this.calls.values()].filter((c) => c.status === "open" && c.expiresAt <= now);
        for (const call of due) {
            await this.decide(call.id, call.defaultDecision, "default");
        }
        for (const [id, call] of this.calls) {
            if (call.status !== "open" && now - call.expiresAt > 10 * 60_000) {
                this.calls.delete(id);
            }
        }
    }
}
