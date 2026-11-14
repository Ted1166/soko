import { useEffect, useRef, useState } from "react";

import { defaultLabel, outcomes } from "../lib/radio";
import type { Decision, RadioCall } from "../types";

interface Props {
    call: RadioCall;
    endsAt: number;
    busy: boolean;
    onDecide: (decision: Decision) => void;
}

const RING = 2 * Math.PI * 28;

export function RadioSheet({ call, endsAt, busy, onDecide }: Props) {
    const total = Math.max(1, call.expiresAt - call.issuedAt);
    const [left, setLeft] = useState(() => Math.max(0, endsAt - Date.now()));
    const sheet = useRef<HTMLElement>(null);

    useEffect(() => {
        const timer = window.setInterval(() => setLeft(Math.max(0, endsAt - Date.now())), 200);
        return () => window.clearInterval(timer);
    }, [endsAt]);

    useEffect(() => {
        sheet.current?.focus();
    }, [call.id]);

    const seconds = Math.ceil(left / 1000);
    const fraction = Math.min(1, left / total);
    const widest = Math.max(call.myPrice, call.rivalPrice, 1);
    const choices = outcomes(call);
    const closed = left <= 0 || busy;

    return (
        <div className="radio-backdrop">
            <section ref={sheet} tabIndex={-1} className="radio" role="dialog" aria-modal="true" aria-labelledby="radio-title">
                <div className="radio-edge" aria-hidden="true" />
                <header className="radio-head">
                    <div>
                        <p className="radio-from">Radio call, {call.good}</p>
                        <h2 id="radio-title" className="radio-title">
                            {call.npcName} is calling
                        </h2>
                    </div>
                    <div className="ring" role="timer" aria-label={`${seconds} seconds left`}>
                        <svg viewBox="0 0 64 64" aria-hidden="true">
                            <circle className="ring-track" cx="32" cy="32" r="28" />
                            <circle
                                className="ring-fill"
                                cx="32"
                                cy="32"
                                r="28"
                                strokeDasharray={RING}
                                strokeDashoffset={RING * (1 - fraction)}
                            />
                        </svg>
                        <span className="ring-seconds">{seconds}</span>
                    </div>
                </header>

                <p className="radio-line">{call.text}</p>

                <div className="duel" aria-label="Price comparison">
                    <div className="duel-row">
                        <span className="duel-name">Your price</span>
                        <span className="duel-bar">
                            <span className="duel-fill mine" style={{ width: `${(call.myPrice / widest) * 100}%` }} />
                        </span>
                        <span className="duel-value">{call.myPrice}</span>
                    </div>
                    <div className="duel-row">
                        <span className="duel-name">Rival</span>
                        <span className="duel-bar">
                            <span className="duel-fill rival" style={{ width: `${(call.rivalPrice / widest) * 100}%` }} />
                        </span>
                        <span className="duel-value">{call.rivalPrice}</span>
                    </div>
                    <p className="duel-note">{call.undercutPct}% cheaper than you</p>
                </div>

                <div className="choices">
                    {choices.map((choice) => (
                        <button
                            key={choice.decision}
                            type="button"
                            className={`choice choice-${choice.decision}`}
                            disabled={closed}
                            onClick={() => onDecide(choice.decision)}
                        >
                            <span className="choice-label">{choice.label}</span>
                            <span className="choice-detail">{choice.detail}</span>
                            {call.defaultDecision === choice.decision ? <span className="choice-badge">default</span> : null}
                        </button>
                    ))}
                </div>

                <p className="radio-foot">
                    If you do nothing, {call.npcName} will {defaultLabel(call.defaultDecision)}.
                </p>
            </section>
        </div>
    );
}
