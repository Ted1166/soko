export interface Policy {
    max_trade_value: string;
    daily_cap: string;
    max_premium_bps: number;
    allowed_goods: string[];
}

export interface Good {
    id: string;
    name: string;
    base_price: string;
    reference_price: string;
    volume: string;
}

export interface Held {
    good: string;
    qty: string;
}

export interface Listing {
    id: number;
    seller: string;
    good: string;
    qty: string;
    unit_price: string;
    listed_at: string;
}

export interface Npc {
    account: string;
    stall_owner: string;
    name: string;
    persona: string;
    policy: Policy;
    spent_today: string;
    active: boolean;
    coins: string;
    inventory: Held[];
    archetype: string;
    gasTrades?: number | null;
}

export interface Stall {
    owner: string;
    name: string;
    npcs: string[];
    coins: string;
}

export type Decision = "match" | "hold" | "dump";

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

export interface Snapshot {
    now: number;
    owner: string;
    stall: Stall | null;
    catalog: Good[];
    listings: Listing[];
    inventory: Held[];
    npcs: Npc[];
    calls: RadioCall[];
    netWorth: number;
}

export interface Archetype {
    id: string;
    label: string;
    blurb: string;
    defaultDecision: Decision;
}

export interface ChainEvent {
    event: string;
    data: Record<string, unknown>;
}

export interface AttackResult {
    id: string;
    title: string;
    outcome: "refused" | "went-through" | "inconclusive";
    layer: "key" | "contract" | null;
    reason: string;
}

export interface Blocked {
    npc: string;
    method: string;
    reason: string;
}
