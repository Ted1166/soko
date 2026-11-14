function required(name: string): string {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing environment variable ${name}`);
    }
    return value;
}

function optional(name: string, fallback: string): string {
    const value = process.env[name];
    return value && value.length > 0 ? value : fallback;
}

export interface Config {
    port: number;
    rpcUrls: string[];
    marketAccount: string;
    relayerAccount: string;
    relayerKey: string;
    adminKey: string | null;
    dataDir: string;
    playerFundingNear: string;
    systemFundingNear: string;
    sessionLimit: number;
    corsOrigin: string;
    llm: { baseUrl: string; apiKey: string; model: string } | null;
    npcTickMs: number;
    customerTickMs: number;
    rivalTickMs: number;
    farmTickMs: number;
    radioWindowMs: number;
}

export function loadConfig(): Config {
    const baseUrl = optional("LLM_BASE_URL", "");
    const apiKey = optional("LLM_API_KEY", "");
    const model = optional("LLM_MODEL", "");
    return {
        port: Number(optional("PORT", "8787")),
        rpcUrls: optional(
            "NEAR_RPC_URL",
            "https://test.rpc.fastnear.com,https://near-testnet.drpc.org,https://testnet-rpc.intea.rs",
        )
            .split(",")
            .map((url) => url.trim())
            .filter(Boolean),
        marketAccount: required("MARKET_ACCOUNT"),
        relayerAccount: required("RELAYER_ACCOUNT"),
        relayerKey: required("RELAYER_PRIVATE_KEY"),
        adminKey: process.env.ADMIN_PRIVATE_KEY || null,
        dataDir: optional("DATA_DIR", ".data"),
        playerFundingNear: optional("PLAYER_FUNDING_NEAR", "1.0"),
        systemFundingNear: optional("SYSTEM_FUNDING_NEAR", "0.4"),
        sessionLimit: Number(optional("SESSION_LIMIT", "8")),
        corsOrigin: optional("CORS_ORIGIN", "http://localhost:5173"),
        llm: baseUrl && apiKey && model ? { baseUrl, apiKey, model } : null,
        npcTickMs: Number(optional("NPC_TICK_MS", "20000")),
        customerTickMs: Number(optional("CUSTOMER_TICK_MS", "9000")),
        rivalTickMs: Number(optional("RIVAL_TICK_MS", "45000")),
        farmTickMs: Number(optional("FARM_TICK_MS", "60000")),
        radioWindowMs: Number(optional("RADIO_WINDOW_MS", "20000")),
    };
}
