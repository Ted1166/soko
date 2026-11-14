import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export class KeyStore {
    private readonly file: string;
    private readonly saved: Record<string, string>;
    private readonly memory = new Map<string, string>();

    constructor(dir: string) {
        mkdirSync(dir, { recursive: true });
        this.file = join(dir, "keys.json");
        this.saved = existsSync(this.file)
            ? JSON.parse(readFileSync(this.file, "utf8"))
            : {};
    }

    get(accountId: string): string | undefined {
        return this.memory.get(accountId) ?? this.saved[accountId];
    }

    set(accountId: string, privateKey: string): void {
        this.saved[accountId] = privateKey;
        writeFileSync(this.file, JSON.stringify(this.saved, null, 2), { mode: 0o600 });
    }

    names(): string[] {
        return Object.keys(this.saved);
    }

    setMemory(accountId: string, privateKey: string): void {
        this.memory.set(accountId, privateKey);
    }
}
