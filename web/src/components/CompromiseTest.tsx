import { useState } from "react";

import { api } from "../api";
import { useGame } from "../game";
import type { AttackResult, Npc } from "../types";

const BADGE = {
    refused: "Refused",
    "went-through": "Went through",
    inconclusive: "Unclear",
} as const;

function where(result: AttackResult): string {
    if (result.layer === "key") {
        return "Stopped by the trader's key";
    }
    if (result.layer === "contract") {
        return "Stopped by the market";
    }
    return "";
}

export function CompromiseTest({ npc }: { npc: Npc }) {
    const { token } = useGame();
    const [busy, setBusy] = useState(false);
    const [results, setResults] = useState<AttackResult[] | null>(null);
    const [problem, setProblem] = useState<string | null>(null);

    async function run() {
        if (!token) {
            return;
        }
        setBusy(true);
        setProblem(null);
        setResults(null);
        try {
            const answer = await api.rogueTest(token, npc.account);
            setResults(answer.results);
        } catch (failure) {
            setProblem(failure instanceof Error ? failure.message : "Something went wrong");
        } finally {
            setBusy(false);
        }
    }

    const refused = results?.filter((r) => r.outcome === "refused").length ?? 0;

    return (
        <section className="trial" aria-labelledby="trial-title">
            <h2 id="trial-title" className="section-title">
                Test your limits
            </h2>
            <p className="lead">
                Pretend {npc.name} has been hijacked. Its own key will try to break the rules, live, and the market has to refuse every attempt.
            </p>

            <button type="button" className="btn btn-main btn-wide" disabled={busy} onClick={() => void run()}>
                {busy ? `${npc.name} is misbehaving… this takes about 20 seconds` : `Simulate a compromised ${npc.name}`}
            </button>

            {problem ? (
                <p className="problem" role="alert">
                    {problem}
                </p>
            ) : null}

            {results ? (
                <div className="trial-results" aria-live="polite">
                    <p className="trial-summary">
                        {refused} of {results.length} attempts refused
                    </p>
                    <ul className="attack-list">
                        {results.map((result) => (
                            <li key={result.id} className={`attack is-${result.outcome}`}>
                                <span className="attack-badge">{BADGE[result.outcome]}</span>
                                <div>
                                    <p className="attack-title">{result.title}</p>
                                    {result.layer ? (
                                        <p className="attack-why">
                                            {where(result)}: <q>{result.reason}</q>
                                        </p>
                                    ) : (
                                        <p className="attack-why">{result.reason}</p>
                                    )}
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </section>
    );
}
