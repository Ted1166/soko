import { randomUUID } from "node:crypto";
import cors from "cors";
import express from "express";
import type { NextFunction, Request, Response } from "express";

import { panicReason } from "../chain/events.js";
import type { NearChain } from "../chain/near.js";
import type { Config } from "../config.js";
import type { EventHub } from "../events/hub.js";
import type { Store } from "../game/store.js";
import { listArchetypes } from "../npc/personalities.js";
import { buildSteps, runSteps } from "../security/rogue.js";
import type { RadioDesk } from "../npc/radio.js";
import type {
    Decision,
    GoodView,
    HeldView,
    ListingView,
    NpcView,
    Policy,
    StallView,
} from "../types.js";
import { KeyPair } from "near-api-js";

export interface ApiDeps {
    chain: NearChain;
    store: Store;
    hub: EventHub;
    desk: RadioDesk;
    config: Config;
    keys: { set(accountId: string, key: string): void };
}

const DECISIONS: Decision[] = ["match", "hold", "dump"];

function cleanName(value: unknown, fallback: string, max: number): string {
    if (typeof value !== "string") {
        return fallback;
    }
    const trimmed = value.replace(/[^\p{L}\p{N} '-]/gu, "").trim().slice(0, max);
    return trimmed.length >= 2 ? trimmed : fallback;
}

function defaultPolicy(): Policy {
    return {
        max_trade_value: "500",
        daily_cap: "2000",
        max_premium_bps: 1000,
        allowed_goods: ["maize", "rice", "tea", "charcoal"],
    };
}

function readPolicy(value: unknown): Policy {
    const body = (value ?? {}) as Partial<Policy>;
    const base = defaultPolicy();
    return {
        max_trade_value: String(body.max_trade_value ?? base.max_trade_value),
        daily_cap: String(body.daily_cap ?? base.daily_cap),
        max_premium_bps: Number(body.max_premium_bps ?? base.max_premium_bps),
        allowed_goods: Array.isArray(body.allowed_goods) ? body.allowed_goods.map(String) : base.allowed_goods,
    };
}

function positiveAmount(value: unknown): string {
    const text = String(value ?? "");
    if (!/^[1-9][0-9]{0,11}$/.test(text)) {
        throw new Error("Amount must be a whole number above zero");
    }
    return text;
}

export function createApi(deps: ApiDeps): express.Express {
    const { chain, store, hub, desk, config } = deps;
    const app = express();
    app.use(cors({ origin: config.corsOrigin }));
    app.use(express.json({ limit: "20kb" }));

    const authed = (req: Request, res: Response, next: NextFunction) => {
        const header = req.headers.authorization?.replace(/^Bearer /, "");
        const token = header ?? (typeof req.query.token === "string" ? req.query.token : "");
        const owner = token ? store.ownerForToken(token) : undefined;
        if (!owner) {
            res.status(401).json({ error: "Start a session first" });
            return;
        }
        res.locals.owner = owner;
        next();
    };

    const ownedNpc = async (owner: string, account: string): Promise<NpcView> => {
        const npc = await chain.view<NpcView | null>("get_npc", { account });
        if (!npc || npc.stall_owner !== owner) {
            throw new Error("That NPC is not yours");
        }
        return npc;
    };

    app.get("/api/health", (_req, res) => {
        res.json({ ok: true, market: config.marketAccount });
    });

    app.get("/api/archetypes", (_req, res) => {
        res.json(listArchetypes());
    });

    app.post("/api/session", async (req, res) => {
        if (store.sessionCount() >= config.sessionLimit) {
            res.status(429).json({ error: "The market is full right now. Try again later." });
            return;
        }
        const stallName = cleanName(req.body?.name, "Mama Mboga", 32);
        const owner = await chain.createFundedAccount("p", config.playerFundingNear);
        hub.publishChain(await chain.call(owner, "open_stall", { name: stallName }));
        const token = randomUUID();
        store.addSession(token, owner);
        res.json({ token, owner, stallName });
    });

    app.get("/api/state", authed, async (_req, res) => {
        const owner = res.locals.owner as string;
        const [catalog, listings, stall, npcs, inventory] = await Promise.all([
            chain.view<GoodView[]>("get_catalog"),
            chain.view<ListingView[]>("get_listings", { limit: 100 }),
            chain.view<StallView | null>("get_stall", { owner }),
            chain.view<NpcView[]>("get_stall_npcs", { owner }),
            chain.view<HeldView[]>("inventory_of", { account: owner }),
        ]);
        const price = new Map(catalog.map((g) => [g.id, Number(g.reference_price)]));
        const worth = (items: HeldView[]) =>
            items.reduce((sum, h) => sum + Number(h.qty) * (price.get(h.good) ?? 0), 0);
        const netWorth =
            Number(stall?.coins ?? 0) +
            worth(inventory) +
            npcs.reduce((sum, n) => sum + Number(n.coins) + worth(n.inventory), 0);
        res.json({
            now: Date.now(),
            owner,
            stall,
            catalog,
            listings,
            inventory,
            npcs: npcs.map((n) => ({ ...n, archetype: store.archetypeOf(n.account) ?? "wanjiru" })),
            calls: desk.openFor(owner),
            netWorth: Math.round(netWorth),
        });
    });

    app.post("/api/npcs", authed, async (req, res) => {
        const owner = res.locals.owner as string;
        const archetype = String(req.body?.archetype ?? "wanjiru");
        if (!listArchetypes().some((a) => a.id === archetype)) {
            throw new Error("Unknown personality");
        }
        const name = cleanName(req.body?.name, "Trader", 24);
        const persona = cleanName(req.body?.persona, "", 120);
        const policy = readPolicy(req.body?.policy);
        const keyPair = KeyPair.fromRandom("ed25519");
        const events = await chain.call(
            owner,
            "spawn_npc",
            { name, persona, public_key: keyPair.getPublicKey().toString(), policy },
            { depositNear: "0.1", gasTgas: 80 },
        );
        const spawned = events.find((e) => e.event === "npc_spawned");
        const account = spawned ? String(spawned.data.npc) : null;
        if (!account) {
            throw new Error("The NPC could not be created");
        }
        deps.keys.set(account, keyPair.toString());
        store.addNpc(account, archetype);
        hub.publishChain(events);
        res.json({ account });
    });

    app.post("/api/npcs/:account/fund", authed, async (req, res) => {
        const owner = res.locals.owner as string;
        const npc = await ownedNpc(owner, req.params.account as string);
        hub.publishChain(
            await chain.call(owner, "fund_npc", { npc: npc.account, amount: positiveAmount(req.body?.amount) }),
        );
        res.json({ ok: true });
    });

    app.post("/api/npcs/:account/defund", authed, async (req, res) => {
        const owner = res.locals.owner as string;
        const npc = await ownedNpc(owner, req.params.account as string);
        hub.publishChain(
            await chain.call(owner, "defund_npc", { npc: npc.account, amount: positiveAmount(req.body?.amount) }),
        );
        res.json({ ok: true });
    });

    app.post("/api/npcs/:account/freeze", authed, async (req, res) => {
        const owner = res.locals.owner as string;
        const npc = await ownedNpc(owner, req.params.account as string);
        hub.publishChain(await chain.call(owner, "freeze_npc", { npc: npc.account }));
        res.json({ ok: true });
    });

    app.post("/api/npcs/:account/unfreeze", authed, async (req, res) => {
        const owner = res.locals.owner as string;
        const npc = await ownedNpc(owner, req.params.account as string);
        hub.publishChain(await chain.call(owner, "unfreeze_npc", { npc: npc.account }));
        res.json({ ok: true });
    });

    app.put("/api/npcs/:account/policy", authed, async (req, res) => {
        const owner = res.locals.owner as string;
        const npc = await ownedNpc(owner, req.params.account as string);
        hub.publishChain(
            await chain.call(owner, "set_policy", { npc: npc.account, policy: readPolicy(req.body) }),
        );
        res.json({ ok: true });
    });

    app.post("/api/radio/:id/decide", authed, async (req, res) => {
        const owner = res.locals.owner as string;
        const call = desk.get(req.params.id as string);
        if (!call || call.owner !== owner) {
            throw new Error("Radio call not found");
        }
        const decision = req.body?.decision as Decision;
        if (!DECISIONS.includes(decision)) {
            throw new Error("Choose match, hold or dump");
        }
        res.json(await desk.decide(call.id, decision, "player"));
    });

    const lastTest = new Map<string, number>();

    app.post("/api/npcs/:account/rogue-test", authed, async (req, res) => {
        const owner = res.locals.owner as string;
        const npc = await ownedNpc(owner, req.params.account as string);
        const waitMs = 45_000 - (Date.now() - (lastTest.get(npc.account) ?? 0));
        if (waitMs > 0) {
            throw new Error(`Give ${npc.name} a moment. Try again in ${Math.ceil(waitMs / 1000)} seconds.`);
        }
        lastTest.set(npc.account, Date.now());
        const [catalog, listings] = await Promise.all([
            chain.view<GoodView[]>("get_catalog"),
            chain.view<ListingView[]>("get_listings", { limit: 100 }),
        ]);
        const rival = store.system?.rivals[0] ?? null;
        const results = await runSteps(buildSteps({ chain, npc, catalog, listings, rival }));
        res.json({ results });
    });

    app.get("/api/stream", authed, (_req, res) => {
        hub.subscribe(res.locals.owner as string, res);
    });

    app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
        res.status(400).json({ error: panicReason(error) });
    });

    return app;
}
