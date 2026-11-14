import { useGame } from "../game";
import { clock, coins, plain } from "../lib/format";

export function Ledger() {
    const { feed, snapshot } = useGame();
    const trades = feed.filter((item) => item.trade);
    const spent = trades.reduce((sum, t) => sum + (t.trade?.side === "bought" ? t.trade.value : 0), 0);
    const earned = trades.reduce((sum, t) => sum + (t.trade?.side === "sold" ? t.trade.value : 0), 0);

    return (
        <>
            <section className="stall-head">
                <h2 className="stall-name">This session</h2>
                <dl className="stall-figures">
                    <div>
                        <dt>Spent buying</dt>
                        <dd>{coins(spent)}</dd>
                    </div>
                    <div>
                        <dt>Earned selling</dt>
                        <dd>{coins(earned)}</dd>
                    </div>
                    <div>
                        <dt>Net</dt>
                        <dd className={earned - spent >= 0 ? "gain" : "loss"}>{coins(earned - spent)}</dd>
                    </div>
                    <div>
                        <dt>Everything you own</dt>
                        <dd>{coins(snapshot?.netWorth ?? 0)}</dd>
                    </div>
                </dl>
            </section>

            <section aria-labelledby="trades-title">
                <h2 id="trades-title" className="section-title">
                    Your trades
                </h2>
                {trades.length === 0 ? (
                    <p className="empty">No trades yet this session. Your traders' deals will be listed here as they happen.</p>
                ) : (
                    <ul className="trade-list">
                        {trades.map((item) => (
                            <li key={item.id} className="trade">
                                <time className="talk-time">{clock(item.at)}</time>
                                <span className="trade-what">
                                    {item.trade?.side === "bought" ? "Bought" : "Sold"} {plain(item.trade?.qty ?? 0)} {item.trade?.good} at{" "}
                                    {plain(item.trade?.price ?? 0)}
                                    <small> with {item.trade?.who}</small>
                                </span>
                                <span className={`trade-value ${item.trade?.side === "bought" ? "loss" : "gain"}`}>
                                    {item.trade?.side === "bought" ? "−" : "+"}
                                    {plain(item.trade?.value ?? 0)}
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
            </section>
        </>
    );
}
