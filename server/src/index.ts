import "./net.js";
import { NearChain } from "./chain/near.js";
import { KeyStore } from "./chain/keystone.js";
import { createApi } from "./api/server.js";
import { loadConfig } from "./config.js";
import { EventHub } from "./events/hub.js";
import { Store } from "./game/store.js";
import { Llm } from "./npc/llm.js";
import { RadioDesk } from "./npc/radio.js";
import { Scheduler } from "./npc/scheduler.js";

const config = loadConfig();
const keys = new KeyStore(config.dataDir);
keys.setMemory(config.relayerAccount, config.relayerKey);
const chain = new NearChain(config.rpcUrls, config.marketAccount, config.relayerAccount, keys);
const store = new Store(config.dataDir);
const hub = new EventHub();
const llm = new Llm(config.llm);
const log = (message: string) => console.log(`[soko] ${message}`);

const desk = new RadioDesk(
    async (call, price) => {
        hub.publishChain(
            await chain.call(call.npc, "reprice_listing", {
                listing_id: call.listingId,
                unit_price: String(price),
            }, { gasTgas: 10 }),
        );
    },
    (call) =>
        hub.publishPrivate(call.owner, call.status === "open" ? "radio_call" : "radio_update", call),
    { windowMs: config.radioWindowMs, cooldownMs: 90_000 },
);

const scheduler = new Scheduler({ chain, store, hub, desk, llm, config, log });
const app = createApi({ chain, store, hub, desk, config, keys });

app.listen(config.port, () => {
    log(`api on http://localhost:${config.port}`);
    log(llm.enabled ? "npc voices: language model" : "npc voices: scripted lines");
    if (!store.system) {
        log("no town yet: run npm run seed first");
    }
    scheduler.start();
});
