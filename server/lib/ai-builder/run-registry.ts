import { AI_ASSISTANT_LIMITS } from "@shared/ai-builder";

export type RunStartRefusal = "already_running" | "hourly_limit";

export type StartedRun = {
	signal: AbortSignal;
	abort: () => void;
	finish: () => void;
};

export type RunStart = { ok: true; run: StartedRun } | { ok: false; reason: RunStartRefusal };

export type RunRegistry = {
	/** Starts a run for this person, or says they are already busy / over the hourly cap. */
	tryStart: (params: { userId: string }) => RunStart;
	/** Aborts the open run for this person. True when there was one. */
	abort: (params: { userId: string }) => boolean;
	hasOpenRun: (params: { userId: string }) => boolean;
};

type OpenRun = { controller: AbortController; timer: ReturnType<typeof setTimeout> };

/**
 * One open run per person, a rolling hourly cap, and a wall-clock abort.
 * Kept in memory: one process is one install.
 */
export function createRunRegistry({
	now = () => Date.now(),
	maxPerHour = AI_ASSISTANT_LIMITS.runsPerHour,
	hourMs = 60 * 60 * 1000,
	runTimeoutMs = AI_ASSISTANT_LIMITS.runTimeoutMs,
}: {
	now?: () => number;
	maxPerHour?: number;
	hourMs?: number;
	runTimeoutMs?: number;
} = {}): RunRegistry {
	const open = new Map<string, OpenRun>();
	const startedAt = new Map<string, number[]>();

	const pruneHour = (userId: string): number[] => {
		const cutoff = now() - hourMs;
		const kept = (startedAt.get(userId) ?? []).filter((stamp) => stamp > cutoff);
		startedAt.set(userId, kept);
		return kept;
	};

	/**
	 * Clears this person's open run. With `only`, it clears it only while that run is still the
	 * open one: a stopped run settles a moment after its request closes, and by then the person
	 * may have started the next run, which must keep its slot, its timer and its Stop.
	 */
	const release = ({ userId, only }: { userId: string; only?: OpenRun }): void => {
		const current = open.get(userId);
		if (!current || (only && current !== only)) return;
		clearTimeout(current.timer);
		open.delete(userId);
	};

	const abortOpen = ({ userId, only }: { userId: string; only?: OpenRun }): boolean => {
		const current = open.get(userId);
		if (!current || (only && current !== only)) return false;
		current.controller.abort();
		release({ userId, only: current });
		return true;
	};

	return {
		tryStart: ({ userId }) => {
			if (open.has(userId)) return { ok: false, reason: "already_running" };
			if (pruneHour(userId).length >= maxPerHour) return { ok: false, reason: "hourly_limit" };

			const controller = new AbortController();
			const entry: OpenRun = {
				controller,
				timer: setTimeout(() => {
					controller.abort();
					release({ userId, only: entry });
				}, runTimeoutMs),
			};
			open.set(userId, entry);
			startedAt.set(userId, [...pruneHour(userId), now()]);

			return {
				ok: true,
				run: {
					signal: controller.signal,
					// Aborts this run's own call even after its slot was released.
					abort: () => {
						controller.abort();
						release({ userId, only: entry });
					},
					finish: () => {
						release({ userId, only: entry });
					},
				},
			};
		},

		abort: ({ userId }) => abortOpen({ userId }),
		hasOpenRun: ({ userId }) => open.has(userId),
	};
}
