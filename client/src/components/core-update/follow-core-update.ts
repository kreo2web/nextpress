import { retryFnWithJitter } from '@shared/retry-fn-with-jitter';
import type { CoreUpdateManageStatus } from '@shared/core-update';
import { checkServerHealth, readCoreUpdateStatus, type CoreUpdateStatusRead } from './core-update-api';

/** What the browser can see of a running update. */
export type CoreUpdatePhase =
  /** The server answers; the runner is waiting, downloading or about to install. */
  | 'waiting'
  /** The server stopped answering: NextPress is restarting. */
  | 'restarting'
  /** The server is back; waiting for the runner's final word. */
  | 'finishing';

export type FollowCoreUpdateOutcome =
  | { kind: 'finished'; status: CoreUpdateManageStatus }
  | { kind: 'signed_out' }
  | { kind: 'lost_track' }
  | { kind: 'aborted' };

export type FollowCoreUpdateDeps = {
  readStatus: (signal?: AbortSignal) => Promise<CoreUpdateStatusRead>;
  waitForServer: (signal?: AbortSignal) => Promise<void>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  random: () => number;
};

/** Long enough for a slow download plus migrations; after that the dashboard says it lost track. */
const MAX_FOLLOW_MS = 45 * 60_000;
/** While the server is down: start at ~1.5 s, back off to ~10 s, give up after 30 minutes. */
const HEALTH_RETRY = { baseDelayMs: 1500, maxDelayMs: 10_000, maxDurationMs: 30 * 60_000 } as const;
/**
 * The server answers its health check but still can't report the update (for example a version without this
 * status, where unknown addresses come back as a web page). After this many tries in a row, stop and say so.
 */
const MAX_UNREADABLE_WHILE_HEALTHY = 5;

const sleepFor = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** 2–3 s between status reads, jittered so several open tabs don't poll in step. */
const pollDelayMs = (random: () => number): number => 2000 + Math.round(random() * 1000);

export const defaultFollowDeps: FollowCoreUpdateDeps = {
  readStatus: readCoreUpdateStatus,
  waitForServer: (signal) =>
    retryFnWithJitter({ fn: () => checkServerHealth(signal), ...HEALTH_RETRY, signal }),
  sleep: sleepFor,
  now: Date.now,
  random: Math.random,
};

/**
 * Follows one update from request to result. The server is expected to disappear while NextPress restarts: then
 * this waits on the health check with jittered backoff (never a fixed hammering loop), and picks the status up
 * again once the server is back.
 */
export async function followCoreUpdate({
  requestId,
  onProgress,
  signal,
  deps = defaultFollowDeps,
  maxDurationMs = MAX_FOLLOW_MS,
}: {
  requestId: string;
  onProgress: (progress: { phase: CoreUpdatePhase; status: CoreUpdateManageStatus | null }) => void;
  signal?: AbortSignal;
  deps?: FollowCoreUpdateDeps;
  maxDurationMs?: number;
}): Promise<FollowCoreUpdateOutcome> {
  const startedAt = deps.now();
  let serverWentAway = false;
  let unreadableInARow = 0;

  for (;;) {
    if (signal?.aborted) return { kind: 'aborted' };
    if (deps.now() - startedAt > maxDurationMs) return { kind: 'lost_track' };

    const read = await deps.readStatus(signal);
    if (read.kind === 'signed_out') return { kind: 'signed_out' };

    if (read.kind === 'unreachable') {
      unreadableInARow += 1;
      if (unreadableInARow > MAX_UNREADABLE_WHILE_HEALTHY) {
        console.warn('[core-update] Server is up but cannot report the update', { atFunction: 'followCoreUpdate', requestId, reason: read.reason });
        return { kind: 'lost_track' };
      }
      if (!serverWentAway) {
        console.info('[core-update] Server stopped answering; waiting for it to come back', { atFunction: 'followCoreUpdate', requestId, reason: read.reason });
      }
      serverWentAway = true;
      onProgress({ phase: 'restarting', status: null });
      try {
        await deps.waitForServer(signal);
      } catch (error) {
        if (signal?.aborted) return { kind: 'aborted' };
        console.warn('[core-update] Server did not come back in time', { atFunction: 'followCoreUpdate', requestId, error });
        return { kind: 'lost_track' };
      }
      await deps.sleep(pollDelayMs(deps.random));
      continue;
    }

    unreadableInARow = 0;
    if (!read.status.canManage) return { kind: 'signed_out' };
    const run = read.status.run;
    if (run && run.requestId === requestId && (run.state === 'done' || run.state === 'failed')) {
      return { kind: 'finished', status: read.status };
    }

    onProgress({ phase: serverWentAway ? 'finishing' : 'waiting', status: read.status });
    await deps.sleep(pollDelayMs(deps.random));
  }
}
