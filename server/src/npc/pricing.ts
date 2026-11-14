export function farmTarget(reference: number, base: number): number {
    const anchored = Math.min(Math.max(reference, base * 0.5), base * 2);
    return Math.max(1, Math.round(anchored * 0.92));
}

export function rivalFloor(base: number): number {
    return Math.max(1, Math.ceil(base * 0.55));
}

export function rivalUndercut(myPrice: number, base: number, roll: number): number | null {
    const price = Math.max(rivalFloor(base), Math.round(myPrice * (0.7 + roll * 0.2)));
    return price < myPrice ? price : null;
}

export function relaxedPrice(price: number, reference: number): number | null {
    if (price >= reference * 0.9) {
        return null;
    }
    const next = Math.min(Math.round(reference * 1.02), Math.round(price * 1.2));
    return next > price ? next : price + 1;
}

export function nextDemand(current: number, roll: number): number {
    const drift = (roll - 0.5) * 0.12 + (1 - current) * 0.1;
    return Math.min(1.5, Math.max(0.7, current + drift));
}
