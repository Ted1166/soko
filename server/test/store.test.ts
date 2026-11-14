import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { Store } from "../src/game/store.js";

const DAY = 24 * 60 * 60 * 1000;
const dirs: string[] = [];

function fresh(): { store: Store; dir: string } {
    const dir = mkdtempSync(join(tmpdir(), "soko-store-"));
    dirs.push(dir);
    return { store: new Store(dir), dir };
}

afterEach(() => {
    for (const dir of dirs.splice(0)) {
        rmSync(dir, { recursive: true, force: true });
    }
});

describe("session limit window", () => {
    it("counts only sessions from the last day", () => {
        const { store } = fresh();
        const now = 10 * DAY;
        store.addSession("old", "a.testnet", now - 2 * DAY);
        store.addSession("recent", "b.testnet", now - DAY / 2);
        store.addSession("new", "c.testnet", now);
        expect(store.recentSessionCount(DAY, now)).toBe(2);
    });

    it("keeps old sessions valid even when they no longer count", () => {
        const { store } = fresh();
        store.addSession("old", "a.testnet", 0);
        expect(store.ownerForToken("old")).toBe("a.testnet");
        expect(store.recentSessionCount(DAY, 10 * DAY)).toBe(0);
    });

    it("does not count sessions saved before timestamps existed", () => {
        const { store, dir } = fresh();
        store.addSession("kept", "a.testnet", Date.now());
        const reopened = new Store(dir);
        expect(reopened.recentSessionCount(DAY)).toBe(1);
    });
});
