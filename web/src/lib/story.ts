import type { ChainEvent, Listing, Npc } from "../types";
import { plain } from "./format";

export interface StoryContext {
    owner: string;
    npcs: Npc[];
    listings: Listing[];
}

export interface Story {
    text: string;
    tone: "trade" | "list" | "price" | "info";
    mine: boolean;
}

const SYSTEM_NAMES: Array<[string, string]> = [
    ["farm-", "Shamba Wholesale"],
    ["rival1-", "Baraka Traders"],
    ["rival2-", "Zawadi Stores"],
    ["buyer1-", "Soko Shoppers"],
    ["buyer2-", "Mtaa Buyers"],
    ["buyer3-", "Pwani Folk"],
];

export function displayName(account: string, context: Pick<StoryContext, "owner" | "npcs">): string {
    if (account === context.owner) {
        return "You";
    }
    const npc = context.npcs.find((n) => n.account === account);
    if (npc) {
        return npc.name;
    }
    const system = SYSTEM_NAMES.find(([prefix]) => account.startsWith(prefix));
    if (system) {
        return system[1];
    }
    if (account.startsWith("p-")) {
        return "A neighbour";
    }
    const slug = account.split(".")[0].replace(/-\d+$/, "");
    return slug.charAt(0).toUpperCase() + slug.slice(1);
}

function mineIn(accounts: string[], context: StoryContext): boolean {
    const mine = new Set([context.owner, ...context.npcs.map((n) => n.account)]);
    return accounts.some((account) => mine.has(account));
}

function text(value: unknown): string {
    return String(value ?? "");
}

export function describe(event: ChainEvent, context: StoryContext): Story | null {
    const data = event.data;
    const name = (key: string) => displayName(text(data[key]), context);
    switch (event.event) {
        case "trade":
            return {
                text: `${name("buyer")} bought ${plain(text(data.qty))} ${text(data.good)} from ${name("seller")} at ${plain(text(data.unit_price))}`,
                tone: "trade",
                mine: mineIn([text(data.buyer), text(data.seller)], context),
            };
        case "listed":
            return {
                text: `${name("seller")} put ${plain(text(data.qty))} ${text(data.good)} on sale at ${plain(text(data.unit_price))}`,
                tone: "list",
                mine: mineIn([text(data.seller)], context),
            };
        case "repriced": {
            const listing = context.listings.find((l) => l.id === Number(data.listing));
            const good = listing ? ` ${listing.good}` : "";
            return {
                text: `${name("seller")} moved${good} from ${plain(text(data.from))} to ${plain(text(data.to))}`,
                tone: "price",
                mine: mineIn([text(data.seller)], context),
            };
        }
        case "npc_spawned":
            return {
                text: `${text(data.name)} joined the market`,
                tone: "info",
                mine: mineIn([text(data.owner)], context),
            };
        case "npc_funded":
            return {
                text: `${name("npc")} received ${plain(text(data.amount))} coins to trade with`,
                tone: "info",
                mine: mineIn([text(data.npc)], context),
            };
        case "npc_frozen":
            return { text: `${name("npc")} is on hold`, tone: "info", mine: mineIn([text(data.npc)], context) };
        case "npc_unfrozen":
            return { text: `${name("npc")} is back at work`, tone: "info", mine: mineIn([text(data.npc)], context) };
        case "policy_updated":
            return { text: `${name("npc")} has new limits`, tone: "info", mine: mineIn([text(data.npc)], context) };
        case "stall_opened":
            return { text: `${text(data.name)} opened a stall`, tone: "info", mine: mineIn([text(data.owner)], context) };
        default:
            return null;
    }
}

const REASONS: Array<[RegExp, string]> = [
    [/daily cap/i, "hit today's spending limit"],
    [/per-trade limit/i, "tried a trade bigger than your per-trade limit"],
    [/too far above market/i, "refused to pay far above the market price"],
    [/not allowed by policy/i, "tried to trade a good you have not allowed"],
    [/frozen/i, "is on hold"],
    [/not enough coins/i, "ran out of coins"],
    [/not enough goods/i, "ran out of stock"],
];

export function explainBlock(reason: string): string {
    const found = REASONS.find(([pattern]) => pattern.test(reason));
    return found ? found[1] : reason;
}
