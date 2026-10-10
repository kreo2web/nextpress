/**
 * Retries an async call with exponential backoff and jitter until it succeeds, the time budget runs out, the
 * caller aborts, or `shouldRetry` says stop. Jitter keeps many callers (tabs, clients) that start failing at
 * the same moment from retrying in lockstep against a server that is just coming back.
 *
 * Wait n (1-based) = random between half and all of min(maxDelayMs, baseDelayMs * 2^(n-1)), so there is always
 * some pause and never a burst.
 */
export type RetryFnWithJitterOptions<T> = {
	fn: (attempt: number) => Promise<T>;
	baseDelayMs: number;
	maxDelayMs: number;
	/** Total time allowed, counted from the first call. The last error is thrown once it is used up. */
	maxDurationMs: number;
	shouldRetry?: (error: Error) => boolean;
	signal?: AbortSignal;
	sleep?: (ms: number) => Promise<void>;
	now?: () => number;
	random?: () => number;
};

const defaultSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const toError = (value: unknown): Error => (value instanceof Error ? value : new Error(String(value)));

/** Wait before the next try, with equal jitter (half fixed, half random). */
export const jitteredDelayMs = ({
	attempt,
	baseDelayMs,
	maxDelayMs,
	random = Math.random,
}: {
	attempt: number;
	baseDelayMs: number;
	maxDelayMs: number;
	random?: () => number;
}): number => {
	const capped = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt - 1));
	return Math.round(capped / 2 + random() * (capped / 2));
};

export async function retryFnWithJitter<T>({
	fn,
	baseDelayMs,
	maxDelayMs,
	maxDurationMs,
	shouldRetry = () => true,
	signal,
	sleep = defaultSleep,
	now = Date.now,
	random = Math.random,
}: RetryFnWithJitterOptions<T>): Promise<T> {
	const startedAt = now();
	let attempt = 0;

	for (;;) {
		if (signal?.aborted) throw new Error("Stopped before it finished");
		attempt += 1;
		try {
			return await fn(attempt);
		} catch (caught) {
			const error = toError(caught);
			if (!shouldRetry(error)) throw error;

			const wait = jitteredDelayMs({ attempt, baseDelayMs, maxDelayMs, random });
			if (now() - startedAt + wait > maxDurationMs) throw error;
			await sleep(wait);
		}
	}
}
