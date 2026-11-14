import type { Decision, RadioCall } from "../types";

export interface Outcome {
    decision: Decision;
    label: string;
    detail: string;
    price: number | null;
}

export function priceFor(decision: Decision, call: Pick<RadioCall, "myPrice" | "rivalPrice">): number | null {
    if (decision === "hold") {
        return null;
    }
    if (decision === "match") {
        return Math.max(1, call.rivalPrice);
    }
    return Math.max(1, Math.floor(call.rivalPrice * 0.85));
}

export function outcomes(call: Pick<RadioCall, "myPrice" | "rivalPrice">): Outcome[] {
    return [
        {
            decision: "match",
            label: "Match",
            detail: `Sell at ${priceFor("match", call)}`,
            price: priceFor("match", call),
        },
        {
            decision: "hold",
            label: "Hold",
            detail: `Keep ${call.myPrice}`,
            price: null,
        },
        {
            decision: "dump",
            label: "Dump",
            detail: `Sell at ${priceFor("dump", call)}`,
            price: priceFor("dump", call),
        },
    ];
}

export function defaultLabel(decision: Decision): string {
    if (decision === "match") {
        return "match the rival";
    }
    if (decision === "hold") {
        return "hold the price";
    }
    return "dump his stock";
}
