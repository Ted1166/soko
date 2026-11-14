import { useEffect, useState } from "react";

import { useGame } from "../game";

const STEPS = [
    "Marking out your plot",
    "Hanging your sign",
    "Stocking the shelves",
    "Opening the shutters",
];

export function Welcome() {
    const { openStall, opening, error } = useGame();
    const [name, setName] = useState("Mama Mboga");
    const [step, setStep] = useState(0);

    useEffect(() => {
        if (!opening) {
            setStep(0);
            return;
        }
        const timer = window.setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2600);
        return () => window.clearInterval(timer);
    }, [opening]);

    return (
        <main className="welcome">
            <div className="welcome-band" aria-hidden="true" />
            <h1 className="welcome-title">Soko</h1>
            <p className="welcome-lead">
                A market town that keeps trading while you look away. Open a stall, hire traders, and decide how much each one is allowed to spend.
            </p>

            <form
                className="welcome-form"
                onSubmit={(event) => {
                    event.preventDefault();
                    void openStall(name.trim() || "Mama Mboga");
                }}
            >
                <label className="field">
                    <span className="field-label">Name your stall</span>
                    <input
                        type="text"
                        value={name}
                        maxLength={32}
                        onChange={(event) => setName(event.target.value)}
                        disabled={opening}
                    />
                </label>
                <button type="submit" className="btn btn-main btn-wide" disabled={opening}>
                    {opening ? `${STEPS[step]}…` : "Open my stall"}
                </button>
            </form>

            <ol className="how">
                <li>
                    <strong>Hire traders</strong>
                    Each has a personality and its own purse. They buy wholesale and sell to the town.
                </li>
                <li>
                    <strong>Set their limits</strong>
                    Choose how much each may spend. The market enforces it, whatever the trader wants.
                </li>
                <li>
                    <strong>Answer the radio</strong>
                    When a rival undercuts, your trader calls. You have 20 seconds to decide.
                </li>
            </ol>

            {error ? (
                <p className="problem" role="alert">
                    {error}
                </p>
            ) : null}
        </main>
    );
}
