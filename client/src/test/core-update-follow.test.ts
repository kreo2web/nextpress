import { describe, expect, it, vi } from 'vitest';
import type { CoreUpdateManageStatus, CoreUpdateRun } from '@shared/core-update';
import { followCoreUpdate, type FollowCoreUpdateDeps } from '@/components/core-update/follow-core-update';
import type { CoreUpdateStatusRead } from '@/components/core-update/core-update-api';
import { currentStageIndex } from '@/components/core-update/core-update-progress-step';
import { describeUpdateNotice } from '@/components/core-update/update-notice';

const run = (overrides: Partial<CoreUpdateRun> = {}): CoreUpdateRun => ({
  requestId: 'req-1',
  state: 'running',
  step: 'download',
  version: '1.4.3',
  fromVersion: '1.4.2',
  code: 'running',
  message: 'Downloading NextPress 1.4.3. Your sites are still online.',
  startedAt: '2026-10-10T12:00:00Z',
  finishedAt: null,
  logPath: '/opt/nextpress/update-logs/update-1.log',
  failedWhileInstalling: false,
  slow: false,
  ...overrides,
});

const status = (overrides: Partial<CoreUpdateManageStatus> = {}): CoreUpdateManageStatus => ({
  canManage: true,
  installedVersion: '1.4.2',
  latestVersion: '1.4.3',
  updateAvailable: true,
  checkOk: true,
  checkedAt: '2026-10-10T12:00:00Z',
  releaseNotesUrl: 'https://github.com/nextpress-ai/nextpress/releases/tag/v1.4.3',
  availability: { ready: true },
  manualCommand: 'sudo nextpress upgrade --version beta-v1.4.3',
  downtime: 'about 2 minutes',
  run: null,
  ...overrides,
});

/** Feeds the follower a script of status reads; sleeping only advances a fake clock. */
const scripted = (reads: CoreUpdateStatusRead[], waitForServer: FollowCoreUpdateDeps['waitForServer'] = async () => undefined) => {
  let time = 0;
  const queue = [...reads];
  const deps: FollowCoreUpdateDeps = {
    readStatus: vi.fn(async (): Promise<CoreUpdateStatusRead> => queue.shift() ?? { kind: 'unreachable', reason: 'script ran out' }),
    waitForServer: vi.fn(waitForServer),
    sleep: async (ms) => {
      time += ms;
    },
    now: () => time,
    random: () => 0.5,
  };
  return { deps, elapsed: () => time };
};

describe('followCoreUpdate', () => {
  it('follows a run through the restart to its result', async () => {
    const phases: string[] = [];
    const finished = status({ installedVersion: '1.4.3', updateAvailable: false, run: run({ state: 'done', code: 'updated' }) });
    const { deps } = scripted([
      { kind: 'ok', status: status({ run: run({ state: 'requested', step: 'waiting' }) }) },
      { kind: 'ok', status: status({ run: run({ step: 'install' }) }) },
      { kind: 'unreachable', reason: 'Failed to fetch' },
      { kind: 'ok', status: status({ run: run({ step: 'install' }) }) },
      { kind: 'ok', status: finished },
    ]);

    const outcome = await followCoreUpdate({ requestId: 'req-1', deps, onProgress: ({ phase }) => phases.push(phase) });
    expect(outcome).toEqual({ kind: 'finished', status: finished });
    expect(phases).toEqual(['waiting', 'waiting', 'restarting', 'finishing']);
    expect(deps.waitForServer).toHaveBeenCalledTimes(1);
  });

  it("keeps waiting while the status still shows someone else's earlier run", async () => {
    const mine = status({ run: run({ state: 'failed', code: 'low_disk' }) });
    const { deps } = scripted([
      { kind: 'ok', status: status({ run: run({ requestId: 'req-old', state: 'done', code: 'updated' }) }) },
      { kind: 'ok', status: mine },
    ]);
    expect(await followCoreUpdate({ requestId: 'req-1', deps, onProgress: () => undefined })).toEqual({ kind: 'finished', status: mine });
  });

  it('stops when the person is signed out or loses access', async () => {
    expect(await followCoreUpdate({ requestId: 'req-1', deps: scripted([{ kind: 'signed_out' }]).deps, onProgress: () => undefined })).toEqual({
      kind: 'signed_out',
    });
    expect(
      await followCoreUpdate({ requestId: 'req-1', deps: scripted([{ kind: 'ok', status: { canManage: false } }]).deps, onProgress: () => undefined }),
    ).toEqual({ kind: 'signed_out' });
  });

  it('says it lost track when the server never comes back', async () => {
    const { deps } = scripted([{ kind: 'unreachable', reason: 'Failed to fetch' }], async () => {
      throw new Error('Health check answered 502');
    });
    expect(await followCoreUpdate({ requestId: 'req-1', deps, onProgress: () => undefined })).toEqual({ kind: 'lost_track' });
  });

  it('stops quickly when the server is back but cannot report the update', async () => {
    const unreadable: CoreUpdateStatusRead = { kind: 'unreachable', reason: 'Unexpected token < in JSON' };
    const { deps } = scripted(Array.from({ length: 20 }, () => unreadable));
    expect(await followCoreUpdate({ requestId: 'req-1', deps, onProgress: () => undefined })).toEqual({ kind: 'lost_track' });
    expect(deps.readStatus).toHaveBeenCalledTimes(6);
  });

  it('does not count a normal restart, where reads fail only until the server is back', async () => {
    const down: CoreUpdateStatusRead = { kind: 'unreachable', reason: 'Failed to fetch' };
    const finished = status({ installedVersion: '1.4.3', updateAvailable: false, run: run({ state: 'done', code: 'updated' }) });
    const waiting: CoreUpdateStatusRead = { kind: 'ok', status: status({ run: run({ step: 'install' }) }) };
    const { deps } = scripted([down, down, down, waiting, down, down, down, down, { kind: 'ok', status: finished }]);
    expect(await followCoreUpdate({ requestId: 'req-1', deps, onProgress: () => undefined })).toEqual({ kind: 'finished', status: finished });
  });

  it('gives up after its time budget, polling at a calm jittered pace', async () => {
    const waiting: CoreUpdateStatusRead = { kind: 'ok', status: status({ run: run() }) };
    const { deps, elapsed } = scripted(Array.from({ length: 50 }, () => waiting));
    const outcome = await followCoreUpdate({ requestId: 'req-1', deps, onProgress: () => undefined, maxDurationMs: 20_000 });
    expect(outcome).toEqual({ kind: 'lost_track' });
    expect(deps.readStatus).toHaveBeenCalledTimes(9);
    expect(elapsed()).toBe(9 * 2500);
  });

  it('stops at once when the dialog closes', async () => {
    const controller = new AbortController();
    controller.abort();
    expect(await followCoreUpdate({ requestId: 'req-1', deps: scripted([]).deps, onProgress: () => undefined, signal: controller.signal })).toEqual({
      kind: 'aborted',
    });
  });
});

describe('progress stages', () => {
  it('maps what the runner says and whether the server answers to one stage', () => {
    expect(currentStageIndex({ phase: 'waiting', run: null })).toBe(0);
    expect(currentStageIndex({ phase: 'waiting', run: run({ state: 'requested', step: 'waiting' }) })).toBe(0);
    expect(currentStageIndex({ phase: 'waiting', run: run({ state: 'running', step: 'waiting' }) })).toBe(0);
    expect(currentStageIndex({ phase: 'waiting', run: run({ step: 'download' }) })).toBe(1);
    expect(currentStageIndex({ phase: 'waiting', run: run({ step: 'install' }) })).toBe(2);
    expect(currentStageIndex({ phase: 'restarting', run: null })).toBe(2);
    expect(currentStageIndex({ phase: 'finishing', run: run({ step: 'install' }) })).toBe(3);
  });
});

describe('update notice', () => {
  it('offers a newer release, follows a running one, and flags one that did not finish', () => {
    expect(describeUpdateNotice(status())).toMatchObject({ tone: 'available', label: 'Update available · v1.4.3', action: 'Update now' });
    expect(describeUpdateNotice(status({ run: run() }))).toMatchObject({ tone: 'running', action: 'View progress' });
    expect(describeUpdateNotice(status({ run: run({ state: 'failed', code: 'low_disk' }) }))).toMatchObject({
      tone: 'problem',
      detail: 'Your sites are running NextPress 1.4.2.',
    });
  });

  it('stays quiet when there is nothing to do', () => {
    expect(describeUpdateNotice(status({ updateAvailable: false, latestVersion: '1.4.2' }))).toBeNull();
    expect(describeUpdateNotice(status({ updateAvailable: false, latestVersion: null, checkOk: false }))).toBeNull();
  });
});
