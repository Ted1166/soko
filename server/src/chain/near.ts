import { randomBytes } from "node:crypto";
import {
    Account,
    JsonRpcProvider,
    KeyPair,
    nearToYocto,
    teraToGas,
} from "near-api-js";
import type { KeyPairString } from "near-api-js";

import type { CallOptions, ChainEvent, MarketChain } from "../types.js";
import { extractEvents, failureMessage, logsFromOutcome } from "./events.js";
import { nearFromYocto } from "./gas.js";
import type { KeyStore } from "./keystone.js";
import { isConnectError, isNetworkError, withRetry } from "./retry.js";

function amount(value: string | number): `${number}` {
    return String(value) as `${number}`;
}

export class NearChain implements MarketChain {
    private readonly providers: JsonRpcProvider[];
    private providerIndex = 0;
    private accounts = new Map<string, Account>();
    private readonly tails = new Map<string, Promise<unknown>>();

    constructor(
        rpcUrls: string[],
        readonly marketAccount: string,
        private readonly relayerAccount: string,
        private readonly keys: KeyStore,
    ) {
        this.providers = rpcUrls.map((url) => new JsonRpcProvider({ url }));
    }

    get provider(): JsonRpcProvider {
        return this.providers[this.providerIndex];
    }

    rotate(): void {
        this.providerIndex = (this.providerIndex + 1) % this.providers.length;
        this.accounts = new Map();
    }

    accountFor(accountId: string): Account {
        const cached = this.accounts.get(accountId);
        if (cached) {
            return cached;
        }
        const key = this.keys.get(accountId);
        if (!key) {
            throw new Error(`No key stored for ${accountId}`);
        }
        const account = new Account(accountId, this.provider, key as KeyPairString);
        this.accounts.set(accountId, account);
        return account;
    }

    async view<T>(method: string, args: Record<string, unknown> = {}): Promise<T> {
        const result = await withRetry(
            () =>
                this.provider.callFunction({
                    contractId: this.marketAccount,
                    method,
                    args,
                }),
            { retryOn: isNetworkError, onRetry: () => this.rotate() },
        );
        return result as unknown as T;
    }

    call(
        signer: string,
        method: string,
        args: Record<string, unknown>,
        options: CallOptions = {},
    ): Promise<ChainEvent[]> {
        return this.serialize(signer, async () => {
            const outcome = await withRetry(
                () =>
                    this.accountFor(signer).callFunctionRaw({
                        contractId: this.marketAccount,
                        methodName: method,
                        args,
                        gas: teraToGas(amount(options.gasTgas ?? 30)),
                        deposit: nearToYocto(amount(options.depositNear ?? "0")),
                        waitUntil: "EXECUTED_OPTIMISTIC",
                    }),
                { retryOn: isConnectError, onRetry: () => this.rotate() },
            );
            const failure = failureMessage(outcome);
            if (failure) {
                throw new Error(failure);
            }
            return extractEvents(logsFromOutcome(outcome));
        });
    }

    async allowanceOf(accountId: string): Promise<number | null> {
        const secret = this.keys.get(accountId);
        if (!secret) {
            return null;
        }
        const publicKey = KeyPair.fromString(secret as KeyPairString).getPublicKey();
        const key = await withRetry(() => this.accountFor(accountId).getAccessKey(publicKey), {
            retryOn: isNetworkError,
            onRetry: () => this.rotate(),
        });
        const permission = key.permission as unknown;
        if (typeof permission !== "object" || permission === null || !("FunctionCall" in permission)) {
            return null;
        }
        const allowance = (permission as { FunctionCall: { allowance: string | null } }).FunctionCall.allowance;
        return allowance === null ? null : nearFromYocto(allowance);
    }

    async createFundedAccount(prefix: string, fundingNear: string): Promise<string> {
        const keyPair = KeyPair.fromRandom("ed25519");
        const accountId = `${prefix}-${randomBytes(3).toString("hex")}.${this.relayerAccount}`;
        this.keys.set(accountId, keyPair.toString());
        await this.serialize(this.relayerAccount, () =>
            withRetry(
                () =>
                    this.accountFor(this.relayerAccount).createAccount({
                        newAccountId: accountId,
                        publicKey: keyPair.getPublicKey(),
                        nearToTransfer: nearToYocto(amount(fundingNear)),
                    }),
                { retryOn: isConnectError, onRetry: () => this.rotate() },
            ),
        );
        return accountId;
    }

    private serialize<T>(signer: string, task: () => Promise<T>): Promise<T> {
        const previous = this.tails.get(signer) ?? Promise.resolve();
        const next = previous.catch(() => undefined).then(task);
        this.tails.set(signer, next);
        return next;
    }
}
