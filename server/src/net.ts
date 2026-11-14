import { Agent, fetch as undiciFetch } from "undici";

const agent = new Agent({
    connect: { timeout: 30_000 },
    keepAliveTimeout: 2_000,
    keepAliveMaxTimeout: 4_000,
    headersTimeout: 60_000,
    bodyTimeout: 60_000,
});

globalThis.fetch = ((input: unknown, init?: Record<string, unknown>) =>
    undiciFetch(input as never, { ...init, dispatcher: agent } as never)) as unknown as typeof fetch;
