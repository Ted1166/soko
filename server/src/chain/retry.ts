const RESET_CODES = new Set(["ECONNRESET", "ETIMEDOUT", "UND_ERR_SOCKET", "UND_ERR_HEADERS_TIMEOUT"]);

const CONNECT_CODES = new Set([
    "UND_ERR_CONNECT_TIMEOUT",
    "ECONNREFUSED",
    "ENOTFOUND",
    "EAI_AGAIN",
]);

export function isConnectError(error: unknown): boolean {
    let current: unknown = error;
    for (let depth = 0; depth < 5 && current; depth += 1) {
        const code = (current as { code?: unknown }).code;
        if (typeof code === "string" && CONNECT_CODES.has(code)) {
            return true;
        }
        current = (current as { cause?: unknown }).cause;
    }
    return false;
}

export function isNetworkError(error: unknown): boolean {
    if (isConnectError(error)) {
        return true;
    }
    let current: unknown = error;
    for (let depth = 0; depth < 5 && current; depth += 1) {
        const code = (current as { code?: unknown }).code;
        if (typeof code === "string" && RESET_CODES.has(code)) {
            return true;
        }
        current = (current as { cause?: unknown }).cause;
    }
    return error instanceof TypeError && /fetch failed/i.test(error.message);
}

export function isRateLimit(error: unknown): boolean {
    const text = error instanceof Error ? error.message : String(error);
    return /rate limits? exceeded|"code":\s*-?429|\b429\b/i.test(text);
}

export function isRetryable(error: unknown): boolean {
    return isNetworkError(error) || isRateLimit(error);
}

export interface RetryOptions {
    attempts?: number;
    delayMs?: number;
    retryOn: (error: unknown) => boolean;
    onRetry?: (error: unknown, attempt: number) => void;
}

export async function withRetry<T>(task: () => Promise<T>, options: RetryOptions): Promise<T> {
    const attempts = options.attempts ?? 4;
    const delayMs = options.delayMs ?? 1_500;
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            return await task();
        } catch (error) {
            lastError = error;
            if (attempt === attempts || !options.retryOn(error)) {
                throw error;
            }
            options.onRetry?.(error, attempt);
            await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
        }
    }
    throw lastError;
}
