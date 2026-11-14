import { useEffect, useState } from "react";

import { CompromiseTest } from "../components/CompromiseTest";
import { useGame } from "../game";
import { clock } from "../lib/format";
import type { Good, Npc, Policy } from "../types";

function draft(policy: Policy) {
    return {
        perTrade: Number(policy.max_trade_value),
        daily: Number(policy.daily_cap),
        premium: Math.round(policy.max_premium_bps / 100),
        goods: new Set(policy.allowed_goods),
    };
}

function LimitsForm({ npc, catalog }: { npc: Npc; catalog: Good[] }) {
    const { saveLimits } = useGame();
    const [form, setForm] = useState(() => draft(npc.policy));
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState<string | null>(null);

    useEffect(() => {
        setForm(draft(npc.policy));
    }, [npc.account, npc.policy]);

    const mistake =
        form.perTrade < 1
            ? "Each trade needs a limit above zero."
            : form.daily < form.perTrade
                ? "The daily limit must cover at least one full trade."
                : form.goods.size === 0
                    ? "Allow at least one good."
                    : null;

    async function save() {
        setBusy(true);
        setProblem(null);
        try {
            await saveLimits(npc.account, {
                max_trade_value: String(form.perTrade),
                daily_cap: String(form.daily),
                max_premium_bps: form.premium * 100,
                allowed_goods: [...form.goods],
            });
        } catch (failure) {
            setProblem(failure instanceof Error ? failure.message : "Something went wrong");
        } finally {
            setBusy(false);
        }
    }

    return (
        <form
            className="limits"
            onSubmit={(event) => {
                event.preventDefault();
                void save();
            }}
        >
            <label className="field">
                <span className="field-label">Most {npc.name} can spend on one trade</span>
                <input
                    type="number"
                    min={1}
                    step={50}
                    value={form.perTrade}
                    onChange={(event) => setForm({ ...form, perTrade: Number(event.target.value) })}
                />
            </label>
            <label className="field">
                <span className="field-label">Most {npc.name} can spend in a day</span>
                <input
                    type="number"
                    min={1}
                    step={100}
                    value={form.daily}
                    onChange={(event) => setForm({ ...form, daily: Number(event.target.value) })}
                />
            </label>
            <label className="field">
                <span className="field-label">
                    Highest price above market {npc.name} will pay: {form.premium}%
                </span>
                <input
                    type="range"
                    min={0}
                    max={50}
                    value={form.premium}
                    onChange={(event) => setForm({ ...form, premium: Number(event.target.value) })}
                />
            </label>
            <fieldset className="goods">
                <legend className="field-label">Goods {npc.name} may trade</legend>
                {catalog.map((good) => (
                    <label key={good.id} className={`chip${form.goods.has(good.id) ? " is-chosen" : ""}`}>
                        <input
                            type="checkbox"
                            checked={form.goods.has(good.id)}
                            onChange={() => {
                                const next = new Set(form.goods);
                                if (next.has(good.id)) {
                                    next.delete(good.id);
                                } else {
                                    next.add(good.id);
                                }
                                setForm({ ...form, goods: next });
                            }}
                        />
                        {good.name}
                    </label>
                ))}
            </fieldset>

            {mistake ? <p className="problem">{mistake}</p> : null}
            {problem ? (
                <p className="problem" role="alert">
                    {problem}
                </p>
            ) : null}

            <button type="submit" className="btn btn-main btn-wide" disabled={busy || mistake !== null}>
                {busy ? "Saving…" : "Save limits"}
            </button>
        </form>
    );
}

export function Limits() {
    const { snapshot, blocks } = useGame();
    const [account, setAccount] = useState<string | null>(null);
    if (!snapshot) {
        return null;
    }
    const { npcs, catalog } = snapshot;
    const chosen = npcs.find((n) => n.account === account) ?? npcs[0];

    if (!chosen) {
        return (
            <p className="empty">
                Limits belong to your traders. Hire one on the My stall tab, then come back to decide how much it may spend.
            </p>
        );
    }

    const mine = blocks.filter((b) => b.npc === chosen.account);

    const stoppedBlock = (
        <section className="stopped" aria-labelledby="stopped-title">
            <h2 id="stopped-title" className="section-title">
                What your limits stopped
            </h2>
            {mine.length === 0 ? (
                <p className="empty">Nothing yet. If {chosen.name} tries to overspend, it will show up here.</p>
            ) : (
                <ul className="talk-list">
                    {mine.map((item) => (
                        <li key={item.id} className="talk-item tone-stop">
                            <time className="talk-time">{clock(item.at)}</time>
                            <span className="talk-text">{item.sentence}</span>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );

    return (
        <>
            <p className="lead">
                These limits are enforced by the market itself. A trader cannot spend past them, even if it wants to.
            </p>

            <div className="segment" role="tablist" aria-label="Choose a trader">
                {npcs.map((npc) => (
                    <button
                        key={npc.account}
                        type="button"
                        role="tab"
                        aria-selected={npc.account === chosen.account}
                        className={`segment-item${npc.account === chosen.account ? " is-active" : ""}`}
                        onClick={() => setAccount(npc.account)}
                    >
                        {npc.name}
                    </button>
                ))}
            </div>

            {mine.length > 0 ? stoppedBlock : null}

            <LimitsForm key={chosen.account} npc={chosen} catalog={catalog} />

            <CompromiseTest key={`test-${chosen.account}`} npc={chosen} />

            {mine.length === 0 ? stoppedBlock : null}
        </>
    );
}
