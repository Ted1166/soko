import type { Response } from "express";

import type { ChainEvent } from "../types.js";

interface Client {
    owner: string;
    res: Response;
}

export class EventHub {
    private readonly clients = new Set<Client>();
    private readonly heartbeat: NodeJS.Timeout;

    constructor() {
        this.heartbeat = setInterval(() => {
            for (const client of this.clients) {
                client.res.write(": keep-alive\n\n");
            }
        }, 20_000);
        this.heartbeat.unref();
    }

    subscribe(owner: string, res: Response): void {
        res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        });
        res.write("retry: 3000\n\n");
        const client = { owner, res };
        this.clients.add(client);
        res.on("close", () => this.clients.delete(client));
    }

    publishPublic(type: string, payload: unknown): void {
        for (const client of this.clients) {
            this.write(client, type, payload);
        }
    }

    publishPrivate(owner: string, type: string, payload: unknown): void {
        for (const client of this.clients) {
            if (client.owner === owner) {
                this.write(client, type, payload);
            }
        }
    }

    publishChain(events: ChainEvent[]): void {
        for (const event of events) {
            this.publishPublic("chain", event);
        }
    }

    private write(client: Client, type: string, payload: unknown): void {
        client.res.write(`event: ${type}\ndata: ${JSON.stringify(payload)}\n\n`);
    }
}
