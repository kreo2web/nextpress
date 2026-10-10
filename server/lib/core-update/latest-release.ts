import {
	fetchLatestReleaseVersion,
	type LatestVersionLookup,
} from "@shared/release/fetch-latest-version";

/** A good answer is reused for 15 minutes; a failed check is retried sooner so an outage doesn't hide updates. */
const SUCCESS_TTL_MS = 15 * 60 * 1000;
const FAILURE_TTL_MS = 2 * 60 * 1000;

export type LatestReleaseLookup = {
	/** Newest official release. `force` skips the cache: used right before starting an update. */
	get: (params?: { force?: boolean }) => Promise<LatestVersionLookup>;
};

/**
 * One shared GitHub release check for the What's New and update routes. Concurrent callers share one request,
 * so a dashboard full of admins polling status never fans out to GitHub (60 calls an hour without a token).
 */
export function createLatestReleaseLookup({
	fallbackVersion,
	fetchLatest = fetchLatestReleaseVersion,
	now = Date.now,
}: {
	fallbackVersion: string;
	fetchLatest?: typeof fetchLatestReleaseVersion;
	now?: () => number;
}): LatestReleaseLookup {
	let cached: { expiresAt: number; value: LatestVersionLookup } | null = null;
	let inFlight: Promise<LatestVersionLookup> | null = null;

	const refresh = (): Promise<LatestVersionLookup> => {
		if (inFlight) return inFlight;
		inFlight = fetchLatest({ fallbackVersion })
			.then((value) => {
				cached = { expiresAt: now() + (value.checkOk ? SUCCESS_TTL_MS : FAILURE_TTL_MS), value };
				return value;
			})
			.finally(() => {
				inFlight = null;
			});
		return inFlight;
	};

	return {
		get: async ({ force = false } = {}) => {
			if (!force && cached && cached.expiresAt > now()) return cached.value;
			return refresh();
		},
	};
}
