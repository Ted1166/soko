import { useState } from "react";

import { PriceBoard } from "../components/PriceBoard";
import { useGame } from "../game";
import { clock } from "../lib/format";

export function Town() {
    const { snapshot, history, feed } = useGame();
    const [mineOnly, setMineOnly] = useState(false);
    if (!snapshot) {
        return null;
    }
    const items = feed.filter((item) => (mineOnly ? item.mine : true)).slice(0, 40);

    return (
        <>
            <PriceBoard catalog={snapshot.catalog} history={history} />

            <section className="talk" aria-labelledby="talk-title">
                <header className="talk-head">
                    <h2 id="talk-title" className="section-title">
                        Town talk
                    </h2>
                    <button type="button" className="btn btn-quiet" aria-pressed={mineOnly} onClick={() => setMineOnly((v) => !v)}>
                        {mineOnly ? "Showing mine" : "Showing everyone"}
                    </button>
                </header>
                {items.length === 0 ? (
                    <p className="empty">The market is quiet. Trades will appear here as they happen.</p>
                ) : (
                    <ul className="talk-list">
                        {items.map((item) => (
                            <li key={item.id} className={`talk-item tone-${item.tone}${item.mine ? " is-mine" : ""}`}>
                                <time className="talk-time">{clock(item.at)}</time>
                                <span className="talk-text">{item.text}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
}
