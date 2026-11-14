import { useEffect, useState } from "react";

import { api } from "../api";
import type { Archetype } from "../types";

interface Props {
    available: number;
    onHire: (input: { name: string; archetype: string; persona: string; coins: number }) => Promise<void>;
    onClose: () => void;
}

export function HireSheet({ available, onHire, onClose }: Props) {
    const [kinds, setKinds] = useState<Archetype[]>([]);
    const [kind, setKind] = useState("juma");
    const [name, setName] = useState("");
    const [coins, setCoins] = useState(Math.min(600, Math.max(0, available)));
    const [busy, setBusy] = useState(false);
    const [problem, setProblem] = useState<string | null>(null);

    useEffect(() => {
        void api.archetypes().then(setKinds).catch(() => undefined);
    }, []);

    const chosen = kinds.find((k) => k.id === kind);

    async function submit() {
        setBusy(true);
        setProblem(null);
        try {
            await onHire({
                name: name.trim() || chosen?.label || "Trader",
                archetype: kind,
                persona: chosen?.blurb ?? "",
                coins,
            });
            onClose();
        } catch (failure) {
            setProblem(failure instanceof Error ? failure.message : "Something went wrong");
            setBusy(false);
        }
    }

    return (
        <div className="sheet-backdrop">
            <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="hire-title">
                <header className="sheet-head">
                    <h2 id="hire-title" className="sheet-title">
                        Hire a trader
                    </h2>
                    <button type="button" className="btn btn-quiet" onClick={onClose} disabled={busy}>
                        Close
                    </button>
                </header>

                <fieldset className="kinds" disabled={busy}>
                    <legend className="field-label">Personality</legend>
                    {kinds.map((k) => (
                        <label key={k.id} className={`kind${kind === k.id ? " is-chosen" : ""}`}>
                            <input type="radio" name="kind" value={k.id} checked={kind === k.id} onChange={() => setKind(k.id)} />
                            <span className="kind-name">{k.label}</span>
                            <span className="kind-blurb">{k.blurb}</span>
                            <span className="kind-default">When a rival undercuts, defaults to {k.defaultDecision}</span>
                        </label>
                    ))}
                </fieldset>

                <label className="field">
                    <span className="field-label">Name</span>
                    <input
                        type="text"
                        value={name}
                        maxLength={24}
                        placeholder={chosen?.label ?? "Trader"}
                        onChange={(event) => setName(event.target.value)}
                        disabled={busy}
                    />
                </label>

                <label className="field">
                    <span className="field-label">Starting coins (you have {available.toLocaleString("en-US")})</span>
                    <input
                        type="number"
                        min={0}
                        max={available}
                        step={50}
                        value={coins}
                        onChange={(event) => setCoins(Math.min(available, Math.max(0, Number(event.target.value))))}
                        disabled={busy}
                    />
                </label>

                {problem ? (
                    <p className="problem" role="alert">
                        {problem}
                    </p>
                ) : null}

                <button type="button" className="btn btn-main btn-wide" disabled={busy} onClick={() => void submit()}>
                    {busy ? "Hiring… this takes a few seconds" : "Hire trader"}
                </button>
            </section>
        </div>
    );
}
