import { apiRequest } from '@/lib/queryClient';
import type { CoreUpdateManageStatus, CoreUpdateStartErrorCode, CoreUpdateStatus } from '@shared/core-update';

export const CORE_UPDATE_STATUS_PATH = '/api/system/update/status';
export const CORE_UPDATE_STATUS_KEY = [CORE_UPDATE_STATUS_PATH] as const;

/** Error thrown by `startCoreUpdate`: the server's plain message, plus its code and HTTP status. */
export type CoreUpdateStartError = Error & { status?: number; code?: CoreUpdateStartErrorCode };

export type StartCoreUpdateResponse = { started: boolean; status: CoreUpdateManageStatus };

/** Confirms the update with the person's password. The server picks the version; `expectedVersion` is checked. */
export async function startCoreUpdate({
  password,
  expectedVersion,
}: {
  password: string;
  expectedVersion: string;
}): Promise<StartCoreUpdateResponse> {
  const response = await apiRequest('POST', '/api/system/update/start', { password, expectedVersion });
  return (await response.json()) as StartCoreUpdateResponse;
}

/** One status read while an update runs. The server going away is expected then, so it is an outcome, not an error. */
export type CoreUpdateStatusRead =
  | { kind: 'ok'; status: CoreUpdateStatus }
  | { kind: 'unreachable'; reason: string }
  | { kind: 'signed_out' };

/** Status read used while following an update: never throws, because a missing server is part of the plan. */
export async function readCoreUpdateStatus(signal?: AbortSignal): Promise<CoreUpdateStatusRead> {
  let response: Response;
  try {
    response = await fetch(CORE_UPDATE_STATUS_PATH, { credentials: 'include', cache: 'no-store', signal });
  } catch (error) {
    return { kind: 'unreachable', reason: error instanceof Error ? error.message : String(error) };
  }
  if (response.status === 401) return { kind: 'signed_out' };
  if (!response.ok) return { kind: 'unreachable', reason: `Status answered ${response.status}` };

  try {
    return { kind: 'ok', status: (await response.json()) as CoreUpdateStatus };
  } catch (error) {
    return { kind: 'unreachable', reason: error instanceof Error ? error.message : String(error) };
  }
}

/** Resolves once the server answers its health check; throws otherwise so the caller can retry. */
export async function checkServerHealth(signal?: AbortSignal): Promise<void> {
  const response = await fetch('/api/health', { cache: 'no-store', signal });
  if (!response.ok) throw new Error(`Health check answered ${response.status}`);
}
