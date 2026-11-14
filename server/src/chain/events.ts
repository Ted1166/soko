import type { ChainEvent } from "../types.js";

const PREFIX = "EVENT_JSON:";

export function extractEvents(logs: string[]): ChainEvent[] {
    const events: ChainEvent[] = [];
    for (const line of logs) {
        if (!line.startsWith(PREFIX)) {
            continue;
        }
        try {
            const parsed = JSON.parse(line.slice(PREFIX.length));
            if (parsed && parsed.standard === "soko" && typeof parsed.event === "string") {
                events.push({ event: parsed.event, data: parsed.data ?? {} });
            }
        } catch {
            continue;
        }
    }
    return events;
}

export function logsFromOutcome(outcome: unknown): string[] {
    const value = outcome as {
        transaction_outcome?: { outcome?: { logs?: string[] } };
        receipts_outcome?: Array<{ outcome?: { logs?: string[] } }>;
    };
    const logs: string[] = [...(value.transaction_outcome?.outcome?.logs ?? [])];
    for (const receipt of value.receipts_outcome ?? []) {
        logs.push(...(receipt.outcome?.logs ?? []));
    }
    return logs;
}

export function failureMessage(outcome: unknown): string | null {
    const status = (outcome as { status?: unknown }).status;
    if (!status || typeof status !== "object" || !("Failure" in status)) {
        return null;
    }
    const text = JSON.stringify((status as { Failure: unknown }).Failure);
    const panic = text.match(/Smart contract panicked: ([^"\\]+)/);
    return panic ? panic[1].trim() : text;
}

export function panicReason(error: unknown): string {
    const text = error instanceof Error ? error.message : String(error);
    const panic = text.match(/Smart contract panicked: ([^"\\\n]+)/);
    return panic ? panic[1].trim() : text;
}
