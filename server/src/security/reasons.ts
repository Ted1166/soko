const POLICY_REASONS = [
    /daily cap/i,
    /per-trade limit/i,
    /too far above market/i,
    /not allowed by policy/i,
    /npc is frozen/i,
    /not enough coins/i,
    /not enough goods/i,
];

export function isPolicyRefusal(reason: string): boolean {
    return POLICY_REASONS.some((pattern) => pattern.test(reason));
}
