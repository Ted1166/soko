import { plain, sparkPoints, trend } from "../lib/format";
import type { Good } from "../types";

interface Props {
    catalog: Good[];
    history: Record<string, number[]>;
}

const ARROWS = { up: "rising", down: "falling", flat: "steady" } as const;

export function PriceBoard({ catalog, history }: Props) {
    return (
        <section className="board" aria-labelledby="board-title">
            <h2 id="board-title" className="board-title">
                Today's prices
            </h2>
            <ul className="board-list">
                {catalog.map((good) => {
                    const series = history[good.id] ?? [];
                    const direction = trend(series);
                    const points = sparkPoints(series, 64, 24);
                    return (
                        <li key={good.id} className="board-row">
                            <span className="board-name">{good.name}</span>
                            <span className={`board-trend is-${direction}`} aria-label={ARROWS[direction]}>
                                {direction === "up" ? "▲" : direction === "down" ? "▼" : ""}
                            </span>
                            <svg className="board-spark" viewBox="0 0 64 24" aria-hidden="true">
                                {points ? <polyline points={points} /> : null}
                            </svg>
                            <span className="board-price">{plain(good.reference_price)}</span>
                            <span className="board-usual">usual {plain(good.base_price)}</span>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
