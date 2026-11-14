import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface SystemAccounts {
    farm: string;
    rivals: string[];
    customers: string[];
}

interface Saved {
    sessions: Record<string, string>;
    sessionTimes?: Record<string, number>;
    npcs: Record<string, { archetype: string }>;
    system: SystemAccounts | null;
}

export class Store {
    private readonly file: string;
    private state: Saved;

    constructor(dir: string) {
        mkdirSync(dir, { recursive: true });
        this.file = join(dir, "game.json");
        this.state = existsSync(this.file)
            ? JSON.parse(readFileSync(this.file, "utf8"))
            : { sessions: {}, npcs: {}, system: null };
        this.state.sessionTimes ??= {};
    }

    private save(): void {
        writeFileSync(this.file, JSON.stringify(this.state, null, 2));
    }

    ownerForToken(token: string): string | undefined {
        return this.state.sessions[token];
    }

    addSession(token: string, owner: string, now: number = Date.now()): void {
        this.state.sessions[token] = owner;
        (this.state.sessionTimes ??= {})[token] = now;
        this.save();
    }

    recentSessionCount(windowMs: number, now: number = Date.now()): number {
        const times = Object.values(this.state.sessionTimes ?? {});
        return times.filter((at) => at > now - windowMs).length;
    }

    sessionCount(): number {
        return Object.keys(this.state.sessions).length;
    }

    addNpc(account: string, archetype: string): void {
        this.state.npcs[account] = { archetype };
        this.save();
    }

    npcAccounts(): string[] {
        return Object.keys(this.state.npcs);
    }

    archetypeOf(account: string): string | undefined {
        return this.state.npcs[account]?.archetype;
    }

    get system(): SystemAccounts | null {
        return this.state.system;
    }

    setSystem(system: SystemAccounts): void {
        this.state.system = system;
        this.save();
    }
}
