import { useState } from "react";

import { plain } from "../lib/format";
import type { Good, Npc } from "../types";
import { SpendMeter } from "./SpendMeter";

interface Props {
    npc: Npc;
    catalog: Good[];
    personality: string;
    onAddCoins: (amount: number) => Promise<void>;
    onToggle: () => Promise<void>;
    onTakeBack: () => Promise<void>;
}

export function NpcCard({ npc, catalog, personality, onAddCoins, onToggle, onTakeBack }: Props) {
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState(200);
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState<string | null>(null);

    const names = new Map(catalog.map((g) => [g.id, g.name]));
    const stock = npc.inventory.filter((h) => Number(h.qty) > 0);
    const gas = npc.gasTrades ?? null;
    const retired = gas === 0;
    const low = gas !== null && gas > 0 && gas < 30;
    const status = retired ? "Out of gas" : low ? "Retiring soon" : npc.active ? "Working" : "On hold";
    const statusClass = retired ? "pill-off" : low ? "pill-warn" : npc.active ? "pill-on" : "pill-off";

    async function run(task: () => Promise<void>) {
        setBusy(true);
        setProblem(null);
        try {
            await task();
            setOpen(false);
        } catch (failure) {
            setProblem(failure instanceof Error ? failure.message : "Something went wrong");
        } finally {
            setBusy(false);
        }
    }

    return (
        <article className={`npc${npc.active && !retired ? "" : " is-held"}`}>
            <header className="npc-head">
                <div>
                    <h3 className="npc-name">{npc.name}</h3>
                    <p className="npc-kind">{personality}</p>
                </div>
                <span className={`pill ${statusClass}`}>{status}</span>
            </header>

            <dl className="npc-figures">
                <div>
                    <dt>Coins</dt>
                    <dd>{plain(npc.coins)}</dd>
                </div>
                <div>
                    <dt>Stock</dt>
                    <dd>{stock.length === 0 ? "none" : stock.map((h) => `${plain(h.qty)} ${names.get(h.good) ?? h.good}`).join(", ")}</dd>
                </div>
                <div>
                    <dt>Gas</dt>
                    <dd>{gas === null ? "unknown" : retired ? "none left" : `about ${gas} trades`}</dd>
                </div>
            </dl>

            <SpendMeter spent={Number(npc.spent_today)} policy={npc.policy} />

            {retired ? (
                <div className="npc-retired">
                    <p>
                        {npc.name} has used all of its gas and cannot trade any more. Its account has no spare key, by design, so it
                        cannot be topped up. Take its coins back and hire a new trader.
                    </p>
                    <button type="button" className="btn btn-main" disabled={busy || Number(npc.coins) <= 0} onClick={() => void run(onTakeBack)}>
                        {Number(npc.coins) > 0 ? `Take back ${plain(npc.coins)} coins` : "Nothing left to take back"}
                    </button>
                </div>
            ) : (
                <div className="npc-actions">
                    <button type="button" className="btn btn-quiet" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
                        Add coins
                    </button>
                    <button type="button" className="btn btn-quiet" disabled={busy} onClick={() => void run(onToggle)}>
                        {npc.active ? "Put on hold" : "Resume work"}
                    </button>
                </div>
            )}

            {open ? (
                <form
                    className="npc-add"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void run(() => onAddCoins(amount));
                    }}
                >
                    <label className="field-inline">
                        <span>Coins to give {npc.name}</span>
                        <input
                            type="number"
                            min={1}
                            step={50}
                            value={amount}
                            onChange={(event) => setAmount(Math.max(1, Number(event.target.value)))}
                        />
                    </label>
                    <button type="submit" className="btn btn-main" disabled={busy}>
                        {busy ? "Sending…" : "Give coins"}
                    </button>
                </form>
            ) : null}

            {problem ? (
                <p className="problem" role="alert">
                    {problem}
                </p>
            ) : null}

            <a
                className="npc-proof"
                href={`https://testnet.nearblocks.io/address/${npc.account}`}
                target="_blank"
                rel="noreferrer"
            >
                See {npc.name}'s limits on the public ledger
            </a>
        </article>
    );
}
