import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";

import { api, ApiError } from "./api";
import { describe, displayName, explainBlock, type Story } from "./lib/story";
import type { Blocked, ChainEvent, Decision, Policy, RadioCall, Snapshot } from "./types";

const TOKEN_KEY = "soko.token";
const HISTORY_LIMIT = 40;
const FEED_LIMIT = 80;

interface RawFeed {
    id: number;
    at: number;
    event: ChainEvent;
}

export interface FeedItem extends Story {
    id: number;
    at: number;
    trade?: {
        side: "bought" | "sold";
        good: string;
        qty: number;
        price: number;
        value: number;
        who: string;
    };
}

export interface BlockItem {
    id: number;
    at: number;
    npcName: string;
    npc: string;
    sentence: string;
    reason: string;
}

export interface ActiveCall {
    call: RadioCall;
    endsAt: number;
}

export interface Toast {
    id: number;
    tone: "ok" | "warn" | "info";
    text: string;
}

interface GameApi {
    token: string | null;
    snapshot: Snapshot | null;
    history: Record<string, number[]>;
    feed: FeedItem[];
    blocks: BlockItem[];
    activeCall: ActiveCall | null;
    toasts: Toast[];
    live: boolean;
    opening: boolean;
    deciding: boolean;
    error: string | null;
    openStall: (name: string) => Promise<void>;
    refresh: () => Promise<void>;
    hire: (input: { name: string; archetype: string; persona: string; coins: number }) => Promise<void>;
    addCoins: (account: string, amount: number) => Promise<void>;
    toggleHold: (account: string, active: boolean) => Promise<void>;
    takeBack: (account: string, amount: number) => Promise<void>;
    saveLimits: (account: string, policy: Policy) => Promise<void>;
    decide: (decision: Decision) => Promise<void>;
    dismissToast: (id: number) => void;
    leave: () => void;
}

const GameContext = createContext<GameApi | null>(null);

export function useGame(): GameApi {
    const value = useContext(GameContext);
    if (!value) {
        throw new Error("useGame must be used inside GameProvider");
    }
    return value;
}

function message(error: unknown): string {
    return error instanceof Error ? error.message : "Something went wrong";
}

export function GameProvider({ children }: { children: ReactNode }) {
    const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
    const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
    const [history, setHistory] = useState<Record<string, number[]>>({});
    const [rawFeed, setRawFeed] = useState<RawFeed[]>([]);
    const [blocks, setBlocks] = useState<BlockItem[]>([]);
    const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [live, setLive] = useState(false);
    const [opening, setOpening] = useState(false);
    const [deciding, setDeciding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const counter = useRef(0);
    const snapshotRef = useRef<Snapshot | null>(null);
    const activeRef = useRef<ActiveCall | null>(null);
    const refreshTimer = useRef<number | null>(null);
    const pendingBlocked = useRef<Blocked[]>([]);

    snapshotRef.current = snapshot;
    activeRef.current = activeCall;

    const nextId = () => {
        counter.current += 1;
        return counter.current;
    };

    const toast = useCallback((tone: Toast["tone"], text: string) => {
        const id = nextId();
        setToasts((current) => [...current.slice(-3), { id, tone, text }]);
        window.setTimeout(() => setToasts((current) => current.filter((t) => t.id !== id)), 5200);
    }, []);

    const leave = useCallback(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setSnapshot(null);
        setRawFeed([]);
        setBlocks([]);
        setActiveCall(null);
        setHistory({});
    }, []);

    const refresh = useCallback(async () => {
        if (!token) {
            return;
        }
        try {
            const next = await api.state(token);
            setSnapshot(next);
            setError(null);
            setHistory((current) => {
                const updated = { ...current };
                for (const good of next.catalog) {
                    const series = [...(updated[good.id] ?? []), Number(good.reference_price)];
                    updated[good.id] = series.slice(-HISTORY_LIMIT);
                }
                return updated;
            });
            const open = next.calls[0];
            if (open && activeRef.current?.call.id !== open.id) {
                setActiveCall({ call: open, endsAt: Date.now() + Math.max(0, open.expiresAt - next.now) });
            }
        } catch (failure) {
            if (failure instanceof ApiError && failure.status === 401) {
                leave();
                return;
            }
            setError(message(failure));
        }
    }, [token, leave]);

    const scheduleRefresh = useCallback(() => {
        if (refreshTimer.current !== null) {
            return;
        }
        refreshTimer.current = window.setTimeout(() => {
            refreshTimer.current = null;
            void refresh();
        }, 1200);
    }, [refresh]);

    useEffect(() => {
        if (!token) {
            return;
        }
        void refresh();
        const poll = window.setInterval(() => {
            if (document.visibilityState === "visible") {
                void refresh();
            }
        }, 8000);
        return () => window.clearInterval(poll);
    }, [token, refresh]);

    const applyChain = useCallback(
        (event: ChainEvent) => {
            if (!describe(event, { owner: "", npcs: [], listings: [] })) {
                return;
            }
            setRawFeed((existing) => [{ id: nextId(), at: Date.now(), event }, ...existing].slice(0, FEED_LIMIT));
            scheduleRefresh();
        },
        [scheduleRefresh],
    );

    const applyBlock = useCallback(
        (data: Blocked, current: Snapshot) => {
            const name = current.npcs.find((n) => n.account === data.npc)?.name ?? "A trader";
            const item: BlockItem = {
                id: nextId(),
                at: Date.now(),
                npcName: name,
                npc: data.npc,
                reason: data.reason,
                sentence: `${name} ${explainBlock(data.reason)}`,
            };
            setBlocks((existing) => [item, ...existing].slice(0, 30));
            toast("warn", `Your limits stopped ${name}: ${explainBlock(data.reason)}`);
        },
        [toast],
    );

    useEffect(() => {
        if (!snapshot) {
            return;
        }
        const blocked = pendingBlocked.current;
        pendingBlocked.current = [];
        for (const data of blocked) {
            applyBlock(data, snapshot);
        }
    }, [snapshot, applyChain, applyBlock]);

    useEffect(() => {
        if (!token) {
            return;
        }
        const source = new EventSource(api.streamUrl(token));
        source.onopen = () => setLive(true);
        source.onerror = () => setLive(false);

        source.addEventListener("chain", (raw) => {
            const event = JSON.parse((raw as MessageEvent).data) as ChainEvent;
            applyChain(event);
        });

        source.addEventListener("radio_call", (raw) => {
            const call = JSON.parse((raw as MessageEvent).data) as RadioCall;
            setActiveCall({ call, endsAt: Date.now() + (call.expiresAt - call.issuedAt) });
            navigator.vibrate?.([120, 80, 120]);
        });

        source.addEventListener("radio_update", (raw) => {
            const call = JSON.parse((raw as MessageEvent).data) as RadioCall;
            if (call.status === "open") {
                return;
            }
            if (activeRef.current?.call.id === call.id) {
                setActiveCall(null);
            }
            if (call.status === "defaulted") {
                toast("info", `Time ran out. ${call.npcName} chose for you. ${call.resolution ?? ""}`.trim());
            }
            scheduleRefresh();
        });

        source.addEventListener("npc_blocked", (raw) => {
            const data = JSON.parse((raw as MessageEvent).data) as Blocked;
            const current = snapshotRef.current;
            if (!current) {
                pendingBlocked.current.push(data);
                return;
            }
            applyBlock(data, current);
        });

        return () => source.close();
    }, [token, scheduleRefresh, toast, applyChain, applyBlock]);

    const openStall = useCallback(async (name: string) => {
        setOpening(true);
        setError(null);
        try {
            const session = await api.createSession(name);
            localStorage.setItem(TOKEN_KEY, session.token);
            setToken(session.token);
        } catch (failure) {
            setError(message(failure));
        } finally {
            setOpening(false);
        }
    }, []);

    const hire = useCallback(
        async (input: { name: string; archetype: string; persona: string; coins: number }) => {
            if (!token) {
                return;
            }
            const created = await api.hire(token, {
                name: input.name,
                archetype: input.archetype,
                persona: input.persona,
            });
            if (input.coins > 0) {
                await api.fund(token, created.account, input.coins);
            }
            toast("ok", `${input.name} is ready to trade`);
            await refresh();
        },
        [token, refresh, toast],
    );

    const addCoins = useCallback(
        async (account: string, amount: number) => {
            if (!token) {
                return;
            }
            await api.fund(token, account, amount);
            toast("ok", `Added ${amount.toLocaleString("en-US")} coins`);
            await refresh();
        },
        [token, refresh, toast],
    );

    const takeBack = useCallback(
        async (account: string, amount: number) => {
            if (!token || amount <= 0) {
                return;
            }
            await api.defund(token, account, amount);
            toast("ok", `Took back ${amount.toLocaleString("en-US")} coins`);
            await refresh();
        },
        [token, refresh, toast],
    );

    const toggleHold = useCallback(
        async (account: string, active: boolean) => {
            if (!token) {
                return;
            }
            if (active) {
                await api.freeze(token, account);
                toast("info", "Trader put on hold");
            } else {
                await api.unfreeze(token, account);
                toast("ok", "Trader back at work");
            }
            await refresh();
        },
        [token, refresh, toast],
    );

    const saveLimits = useCallback(
        async (account: string, policy: Policy) => {
            if (!token) {
                return;
            }
            await api.setPolicy(token, account, policy);
            toast("ok", "Limits saved");
            await refresh();
        },
        [token, refresh, toast],
    );

    const decide = useCallback(
        async (decision: Decision) => {
            const current = activeRef.current;
            if (!token || !current) {
                return;
            }
            setDeciding(true);
            try {
                const result = await api.decide(token, current.call.id, decision);
                setActiveCall(null);
                toast("ok", `${result.npcName}: ${result.resolution ?? "done"}`);
                scheduleRefresh();
            } catch (failure) {
                toast("warn", message(failure));
                if (failure instanceof ApiError && failure.status === 400) {
                    setActiveCall(null);
                }
            } finally {
                setDeciding(false);
            }
        },
        [token, toast, scheduleRefresh],
    );

    const dismissToast = useCallback((id: number) => {
        setToasts((current) => current.filter((t) => t.id !== id));
    }, []);

    const feed = useMemo<FeedItem[]>(() => {
        if (!snapshot) {
            return [];
        }
        const context = { owner: snapshot.owner, npcs: snapshot.npcs, listings: snapshot.listings };
        const items: FeedItem[] = [];
        for (const raw of rawFeed) {
            const story = describe(raw.event, context);
            if (!story) {
                continue;
            }
            const item: FeedItem = { ...story, id: raw.id, at: raw.at };
            if (raw.event.event === "trade" && story.mine) {
                const data = raw.event.data;
                const buyer = String(data.buyer);
                const bought = buyer === snapshot.owner || snapshot.npcs.some((n) => n.account === buyer);
                const other = String(bought ? data.seller : data.buyer);
                item.trade = {
                    side: bought ? "bought" : "sold",
                    good: String(data.good),
                    qty: Number(data.qty),
                    price: Number(data.unit_price),
                    value: Number(data.value),
                    who: displayName(other, context),
                };
            }
            items.push(item);
        }
        return items;
    }, [rawFeed, snapshot]);

    const value = useMemo<GameApi>(
        () => ({
            token,
            snapshot,
            history,
            feed,
            blocks,
            activeCall,
            toasts,
            live,
            opening,
            deciding,
            error,
            openStall,
            refresh,
            hire,
            addCoins,
            toggleHold,
            takeBack,
            saveLimits,
            decide,
            dismissToast,
            leave,
        }),
        [
            token,
            snapshot,
            history,
            feed,
            blocks,
            activeCall,
            toasts,
            live,
            opening,
            deciding,
            error,
            openStall,
            refresh,
            hire,
            addCoins,
            toggleHold,
            takeBack,
            saveLimits,
            decide,
            dismissToast,
            leave,
        ],
    );

    return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
