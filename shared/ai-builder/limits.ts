/** Longest values the server accepts. The Settings screen uses the same numbers for its inputs. */
export const AI_SETTINGS_LIMITS = {
	model: 200,
	baseUrl: 2048,
	apiKey: 1024,
} as const;

/**
 * Caps on one assistant run and on how often one person can start one.
 * Easy to change: the route and the page tools read these numbers, nothing else hard-codes them.
 */
export const AI_ASSISTANT_LIMITS = {
	/** One open run per person. A second start returns 409. */
	concurrentRuns: 1,
	/** Started runs (not refused ones) in a rolling hour. */
	runsPerHour: 30,
	/** Model steps (`streamText` + `isStepCount`). */
	stepsPerRun: 25,
	/** Wall clock for one run, including tool work. */
	runTimeoutMs: 3 * 60 * 1000,
	/** Recent chat turns the route keeps. The editor already trims to 30. */
	maxMessages: 40,
	/** A change that would remove more blocks than this (nested ones included) waits for the person to confirm. */
	confirmRemovalsOver: 10,
} as const;
