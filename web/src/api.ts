import type { Archetype, AttackResult, Decision, Policy, RadioCall, Snapshot } from "./types";

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export class ApiError extends Error {
    constructor(
        message: string,
        readonly status: number,
    ) {
        super(message);
    }
}

async function request<T>(path: string, init: RequestInit = {}, token?: string): Promise<T> {
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (token) {
        headers.authorization = `Bearer ${token}`;
    }
    let response: Response;
    try {
        response = await fetch(`${BASE}${path}`, { ...init, headers });
    } catch {
        throw new ApiError("Cannot reach the market. Check that the server is running.", 0);
    }
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    if (!response.ok) {
        throw new ApiError(body.error ?? "Something went wrong", response.status);
    }
    return body as T;
}

export const api = {
    archetypes: () => request<Archetype[]>("/api/archetypes"),
    createSession: (name: string) =>
        request<{ token: string; owner: string; stallName: string }>("/api/session", {
            method: "POST",
            body: JSON.stringify({ name }),
        }),
    state: (token: string) => request<Snapshot>("/api/state", {}, token),
    hire: (token: string, input: { name: string; archetype: string; persona: string }) =>
        request<{ account: string }>("/api/npcs", { method: "POST", body: JSON.stringify(input) }, token),
    fund: (token: string, account: string, amount: number) =>
        request<{ ok: boolean }>(
            `/api/npcs/${account}/fund`,
            { method: "POST", body: JSON.stringify({ amount: String(amount) }) },
            token,
        ),
    defund: (token: string, account: string, amount: number) =>
        request<{ ok: boolean }>(
            `/api/npcs/${account}/defund`,
            { method: "POST", body: JSON.stringify({ amount: String(amount) }) },
            token,
        ),
    freeze: (token: string, account: string) =>
        request<{ ok: boolean }>(`/api/npcs/${account}/freeze`, { method: "POST", body: "{}" }, token),
    unfreeze: (token: string, account: string) =>
        request<{ ok: boolean }>(`/api/npcs/${account}/unfreeze`, { method: "POST", body: "{}" }, token),
    setPolicy: (token: string, account: string, policy: Policy) =>
        request<{ ok: boolean }>(
            `/api/npcs/${account}/policy`,
            { method: "PUT", body: JSON.stringify(policy) },
            token,
        ),
    rogueTest: (token: string, account: string) =>
        request<{ results: AttackResult[] }>(`/api/npcs/${account}/rogue-test`, { method: "POST", body: "{}" }, token),
    decide: (token: string, id: string, decision: Decision) =>
        request<RadioCall>(
            `/api/radio/${id}/decide`,
            { method: "POST", body: JSON.stringify({ decision }) },
            token,
        ),
    streamUrl: (token: string) => `${BASE}/api/stream?token=${encodeURIComponent(token)}`,
};
