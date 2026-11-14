export interface Policy {
    max_trade_value: string;
    daily_cap: string;
    max_premium_bps: number;
    allowed_goods: string[];
}

export interface GoodView {
    id: string;
    name: string;
    base_price: string;
    reference_price: string;
    volume: string;
}

export interface HeldView {
    good: string;
    qty: string;
}

export interface ListingView {
    id: number;
    seller: string;
    good: string;
    qty: string;
    unit_price: string;
    listed_at: string;
}

export interface NpcView {
    account: string;
    stall_owner: string;
    name: string;
    persona: string;
    policy: Policy;
    spent_today: string;
    active: boolean;
    coins: string;
    inventory: HeldView[];
}

export interface StallView {
    owner: string;
    name: string;
    npcs: string[];
    coins: string;
}

export interface ChainEvent {
    event: string;
    data: Record<string, unknown>;
}

export interface CallOptions {
    depositNear?: string;
    gasTgas?: number;
}

export interface MarketChain {
    view<T>(method: string, args?: Record<string, unknown>): Promise<T>;
    call(
        signer: string,
        method: string,
        args: Record<string, unknown>,
        options?: CallOptions,
    ): Promise<ChainEvent[]>;
}

export type Decision = "match" | "hold" | "dump";
