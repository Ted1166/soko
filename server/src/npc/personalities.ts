import type { Decision } from "../types.js";

export interface Archetype {
    id: string;
    label: string;
    blurb: string;
    defaultDecision: Decision;
    markupBps: number;
    restockBelow: number;
    restockQty: number;
    opening: string[];
}

export const ARCHETYPES: Record<string, Archetype> = {
    wanjiru: {
        id: "wanjiru",
        label: "Mama Wanjiru",
        blurb: "Careful and patient. Prefers to wait out a price war.",
        defaultDecision: "hold",
        markupBps: 1200,
        restockBelow: 20,
        restockQty: 12,
        opening: ["Pole pole, boss.", "Boss, listen."],
    },
    juma: {
        id: "juma",
        label: "Juma",
        blurb: "Bold and quick. Matches any rival on sight.",
        defaultDecision: "match",
        markupBps: 800,
        restockBelow: 25,
        restockQty: 15,
        opening: ["Eh, boss!", "Boss, quick one."],
    },
    otieno: {
        id: "otieno",
        label: "Otieno",
        blurb: "Nervous. Dumps stock at the first sign of trouble.",
        defaultDecision: "dump",
        markupBps: 1000,
        restockBelow: 15,
        restockQty: 10,
        opening: ["Boss, trouble!", "Boss, I am worried."],
    },
};

export function archetypeFor(id: string | undefined): Archetype {
    return (id && ARCHETYPES[id]) || ARCHETYPES.wanjiru;
}

export function listArchetypes(): Archetype[] {
    return Object.values(ARCHETYPES);
}
