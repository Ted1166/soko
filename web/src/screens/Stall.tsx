import { useState } from "react";

import { HireSheet } from "../components/HireSheet";
import { NpcCard } from "../components/NpcCard";
import { useGame } from "../game";
import { coins, plain } from "../lib/format";

const KINDS: Record<string, string> = {
    wanjiru: "Careful and patient",
    juma: "Bold and quick",
    otieno: "Nervous",
};

export function Stall() {
    const { snapshot, hire, addCoins, toggleHold } = useGame();
    const [hiring, setHiring] = useState(false);
    if (!snapshot || !snapshot.stall) {
        return null;
    }
    const { stall, npcs, catalog, inventory } = snapshot;
    const names = new Map(catalog.map((g) => [g.id, g.name]));
    const stock = inventory.filter((h) => Number(h.qty) > 0);

    return (
        <>
            <section className="stall-head">
                <h2 className="stall-name">Your stall</h2>
                <dl className="stall-figures">
                    <div>
                        <dt>In your pocket</dt>
                        <dd>{coins(stall.coins)}</dd>
                    </div>
                    <div>
                        <dt>Everything you own</dt>
                        <dd>{coins(snapshot.netWorth)}</dd>
                    </div>
                </dl>
                {stock.length > 0 ? (
                    <p className="stall-stock">
                        On your shelves: {stock.map((h) => `${plain(h.qty)} ${names.get(h.good) ?? h.good}`).join(", ")}
                    </p>
                ) : null}
            </section>

            <section aria-labelledby="crew-title">
                <header className="talk-head">
                    <h2 id="crew-title" className="section-title">
                        Your traders
                    </h2>
                    <button type="button" className="btn btn-main" onClick={() => setHiring(true)} disabled={npcs.length >= 8}>
                        Hire a trader
                    </button>
                </header>

                {npcs.length === 0 ? (
                    <p className="empty">
                        You have no traders yet. Hire one, give them some coins, and they will buy wholesale and sell to the town.
                    </p>
                ) : (
                    <div className="npc-list">
                        {npcs.map((npc) => (
                            <NpcCard
                                key={npc.account}
                                npc={npc}
                                catalog={catalog}
                                personality={KINDS[npc.archetype] ?? "Trader"}
                                onAddCoins={(amount) => addCoins(npc.account, amount)}
                                onToggle={() => toggleHold(npc.account, npc.active)}
                            />
                        ))}
                    </div>
                )}
            </section>

            {hiring ? (
                <HireSheet available={Number(stall.coins)} onHire={hire} onClose={() => setHiring(false)} />
            ) : null}
        </>
    );
}
