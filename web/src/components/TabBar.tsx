import type { ReactNode } from "react";

export type Tab = "town" | "stall" | "limits" | "ledger";

const ICONS: Record<Tab, ReactNode> = {
    town: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 10 12 4l9 6v2H3z" />
            <path d="M5 12v8h14v-8" />
            <path d="M10 20v-5h4v5" />
        </svg>
    ),
    stall: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 9h18l-2-5H5z" />
            <path d="M5 9v11M19 9v11M5 14h14" />
        </svg>
    ),
    limits: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3 5 6v5c0 4.5 3 8 7 10 4-2 7-5.5 7-10V6z" />
            <path d="m9 12 2 2 4-4" />
        </svg>
    ),
    ledger: (
        <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
            <path d="M9 8h6M9 12h6" />
        </svg>
    ),
};

const LABELS: Record<Tab, string> = {
    town: "Town",
    stall: "My stall",
    limits: "Limits",
    ledger: "Ledger",
};

interface Props {
    tab: Tab;
    onChange: (tab: Tab) => void;
    badge?: number;
}

export function TabBar({ tab, onChange, badge = 0 }: Props) {
    return (
        <nav className="tabs" aria-label="Sections">
            {(Object.keys(LABELS) as Tab[]).map((id) => (
                <button
                    key={id}
                    type="button"
                    className={`tab${tab === id ? " is-active" : ""}`}
                    aria-current={tab === id ? "page" : undefined}
                    onClick={() => onChange(id)}
                >
                    <span className="tab-icon">
                        {ICONS[id]}
                        {id === "limits" && badge > 0 ? <span className="tab-badge">{badge}</span> : null}
                    </span>
                    <span className="tab-label">{LABELS[id]}</span>
                </button>
            ))}
        </nav>
    );
}
