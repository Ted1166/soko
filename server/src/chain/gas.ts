const PREPAID_NEAR = 0.011;
const NEAR_PER_TRADE = 0.0004;

export function tradesLeft(allowanceNear: number | null): number | null {
    if (allowanceNear === null) {
        return null;
    }
    if (allowanceNear < PREPAID_NEAR) {
        return 0;
    }
    return Math.max(0, Math.floor((allowanceNear - PREPAID_NEAR) / NEAR_PER_TRADE));
}

export function nearFromYocto(yocto: string): number {
    return Number(BigInt(yocto)) / 1e24;
}
