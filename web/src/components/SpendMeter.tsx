import { percent, plain } from "../lib/format";
import type { Policy } from "../types";

interface Props {
    spent: number;
    policy: Policy;
}

export function SpendMeter({ spent, policy }: Props) {
    const cap = Number(policy.daily_cap);
    const used = percent(spent, cap);
    const level = used >= 90 ? "hot" : used >= 60 ? "warm" : "cool";
    return (
        <div className="meter">
            <div
                className="meter-bar"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={cap}
                aria-valuenow={spent}
                aria-label="Spent today"
            >
                <span className={`meter-fill is-${level}`} style={{ width: `${used}%` }} />
            </div>
            <p className="meter-text">
                Spent {plain(spent)} of {plain(cap)} today. Up to {plain(policy.max_trade_value)} per trade.
            </p>
        </div>
    );
}
