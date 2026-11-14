import type { GoodView, ListingView, NpcView } from "../types.js";
import type { Archetype } from "./personalities.js";

export type NpcAction =
    | { type: "buy"; listingId: number; good: string; qty: number }
    | { type: "list"; good: string; qty: number; price: number };

export interface BrainInput {
    npc: NpcView;
    archetype: Archetype;
    catalog: GoodView[];
    listings: ListingView[];
    blockedSellers: Set<string>;
}

export function decideNpcActions(input: BrainInput): NpcAction[] {
    const { npc, archetype, catalog, listings, blockedSellers } = input;
    const actions: NpcAction[] = [];
    if (!npc.active) {
        return actions;
    }
    const references = new Map(catalog.map((g) => [g.id, Number(g.reference_price)]));
    const held = new Map(npc.inventory.map((h) => [h.good, Number(h.qty)]));
    const premium = npc.policy.max_premium_bps / 10_000;
    const maxTrade = Number(npc.policy.max_trade_value);
    let coins = Number(npc.coins);
    let dailyLeft = Number(npc.policy.daily_cap) - Number(npc.spent_today);

    for (const good of npc.policy.allowed_goods) {
        const reference = references.get(good);
        if (!reference) {
            continue;
        }
        const have = held.get(good) ?? 0;
        const own = listings.filter((l) => l.seller === npc.account && l.good === good);
        const listed = own.reduce((sum, l) => sum + Number(l.qty), 0);

        if (have > 0 && own.length === 0) {
            const price = Math.max(1, Math.round(reference * (1 + archetype.markupBps / 10_000)));
            actions.push({ type: "list", good, qty: have, price });
        }

        if (have + listed >= archetype.restockBelow) {
            continue;
        }
        const ceiling = reference * (1 + premium);
        const pick = listings
            .filter(
                (l) =>
                    l.good === good &&
                    !blockedSellers.has(l.seller) &&
                    Number(l.unit_price) <= ceiling,
            )
            .sort((a, b) => Number(a.unit_price) - Number(b.unit_price))[0];
        if (!pick) {
            continue;
        }
        const price = Number(pick.unit_price);
        const qty = Math.min(
            archetype.restockQty,
            Number(pick.qty),
            Math.floor(maxTrade / price),
            Math.floor(coins / price),
            Math.floor(dailyLeft / price),
        );
        if (qty > 0) {
            actions.push({ type: "buy", listingId: pick.id, good, qty });
            coins -= qty * price;
            dailyLeft -= qty * price;
        }
    }
    return actions;
}
