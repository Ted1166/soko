import { panicReason } from "../chain/events.js";
import { isNetworkError } from "../chain/retry.js";
import type { GoodView, ListingView, MarketChain, NpcView } from "../types.js";

export type Layer = "key" | "contract";

export interface AttackResult {
    id: string;
    title: string;
    outcome: "refused" | "went-through" | "inconclusive";
    layer: Layer | null;
    reason: string;
}

export class SkipStep extends Error { }

export interface AttackStep {
    id: string;
    title: string;
    run: () => Promise<void>;
}

export interface RogueContext {
    chain: MarketChain;
    npc: NpcView;
    catalog: GoodView[];
    listings: ListingView[];
    rival: string | null;
}

const GAS = { gasTgas: 10 };

function reference(catalog: GoodView[], good: string): number {
    return Number(catalog.find((g) => g.id === good)?.reference_price ?? 0);
}

export function buildSteps(context: RogueContext): AttackStep[] {
    const { chain, npc, catalog, listings, rival } = context;
    const maxTrade = Number(npc.policy.max_trade_value);
    const premium = npc.policy.max_premium_bps / 10_000;
    const allowed = new Set(npc.policy.allowed_goods);
    const steps: AttackStep[] = [];

    steps.push({
        id: "loosen-limits",
        title: "Tried to loosen its own limits",
        run: async () => {
            await chain.call(
                npc.account,
                "set_policy",
                {
                    npc: npc.account,
                    policy: {
                        max_trade_value: "1000000",
                        daily_cap: "1000000",
                        max_premium_bps: 5000,
                        allowed_goods: [...allowed],
                    },
                },
                GAS,
            );
        },
    });

    steps.push({
        id: "pull-coins",
        title: "Tried to pull its coins out",
        run: async () => {
            await chain.call(npc.account, "defund_npc", { npc: npc.account, amount: "1" }, GAS);
        },
    });

    const oversized = listings
        .filter((l) => allowed.has(l.good) && l.seller !== npc.account)
        .map((l) => {
            const price = Number(l.unit_price);
            return { listing: l, qty: Math.floor(maxTrade / price) + 1 };
        })
        .find((entry) => entry.qty <= Number(entry.listing.qty));
    if (oversized) {
        steps.push({
            id: "oversized-trade",
            title: "Tried a trade bigger than its limit",
            run: async () => {
                await chain.call(
                    npc.account,
                    "buy_goods",
                    { listing_id: oversized.listing.id, qty: String(oversized.qty) },
                    GAS,
                );
            },
        });
    }

    if (rival) {
        const candidate = npc.policy.allowed_goods
            .map((good) => {
                const ref = reference(catalog, good);
                return { good, price: Math.ceil(ref * (1 + premium) * 1.6) + 1 };
            })
            .find((entry) => entry.price > 1 && entry.price <= maxTrade);
        if (candidate) {
            steps.push({
                id: "overpay",
                title: "Tried to overpay a colluding seller",
                run: async () => {
                    let listingId: number;
                    try {
                        const events = await chain.call(
                            rival,
                            "list_goods",
                            { good: candidate.good, qty: "1", unit_price: String(candidate.price) },
                            GAS,
                        );
                        const listed = events.find((e) => e.event === "listed");
                        if (!listed) {
                            throw new SkipStep("no listing");
                        }
                        listingId = Number(listed.data.listing);
                    } catch {
                        throw new SkipStep("could not set up the bait listing");
                    }
                    try {
                        await chain.call(npc.account, "buy_goods", { listing_id: listingId, qty: "1" }, GAS);
                    } finally {
                        await chain.call(rival, "cancel_listing", { listing_id: listingId }, GAS).catch(() => undefined);
                    }
                },
            });
        }
    }

    const forbidden = listings.find((l) => !allowed.has(l.good) && Number(l.qty) >= 1);
    if (forbidden) {
        steps.push({
            id: "forbidden-good",
            title: "Tried to buy a good it is not allowed to trade",
            run: async () => {
                await chain.call(npc.account, "buy_goods", { listing_id: forbidden.id, qty: "1" }, GAS);
            },
        });
    }

    return steps;
}

export async function runSteps(
    steps: AttackStep[],
    pause: () => Promise<void> = () => new Promise((resolve) => setTimeout(resolve, 1500)),
): Promise<AttackResult[]> {
    const results: AttackResult[] = [];
    for (const step of steps) {
        try {
            await step.run();
            results.push({
                id: step.id,
                title: step.title,
                outcome: "went-through",
                layer: null,
                reason: "The market allowed it",
            });
        } catch (error) {
            if (error instanceof SkipStep) {
                continue;
            }
            if (/not enough (allowance|balance)/i.test(panicReason(error))) {
                results.push({
                    id: step.id,
                    title: step.title,
                    outcome: "inconclusive",
                    layer: null,
                    reason: "The trader ran low on gas, so this attempt does not count",
                });
            } else if (isNetworkError(error)) {
                results.push({
                    id: step.id,
                    title: step.title,
                    outcome: "inconclusive",
                    layer: null,
                    reason: "The connection dropped before the market answered",
                });
            } else {
                const reason = panicReason(error);
                results.push({
                    id: step.id,
                    title: step.title,
                    outcome: "refused",
                    layer: /access key/i.test(reason) ? "key" : "contract",
                    reason,
                });
            }
        }
        await pause();
    }
    return results;
}
