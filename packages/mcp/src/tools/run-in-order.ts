export type KeyedQueue = <T>(params: { key: string; job: () => Promise<T> }) => Promise<T>;

/**
 * Runs jobs that share a key one after another; jobs with different keys run side by side.
 *
 * WHY: agents often send several page changes at once. Each change reads the page, edits it
 * and saves it with the version it read, so two at the same moment would start from the same
 * version and the second would fail. Queued per page, both succeed in order. (The version
 * check still guards against edits made elsewhere, such as the owner in the dashboard.)
 */
export function createKeyedQueue(): KeyedQueue {
	const tails = new Map<string, Promise<void>>();
	return ({ key, job }) => {
		const run = (tails.get(key) ?? Promise.resolve()).then(job);
		const tail = run.then(
			() => undefined,
			() => undefined,
		);
		tails.set(key, tail);
		// Forget the key once its last job is done, so the map does not grow with every page seen.
		void tail.then(() => {
			if (tails.get(key) === tail) tails.delete(key);
		});
		return run;
	};
}
