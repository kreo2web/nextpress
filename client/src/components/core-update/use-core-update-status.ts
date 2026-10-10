import { useQuery } from '@tanstack/react-query';
import type { CoreUpdateManageStatus, CoreUpdateStatus } from '@shared/core-update';
import { CORE_UPDATE_STATUS_KEY } from './core-update-api';

/**
 * Update status for the signed-in person. Only main-site admins get details; everyone else (and any error)
 * yields `null`, so callers simply show nothing.
 */
export function useCoreUpdateStatus(): CoreUpdateManageStatus | null {
  const { data } = useQuery<CoreUpdateStatus>({
    queryKey: CORE_UPDATE_STATUS_KEY,
    staleTime: 5 * 60_000,
    retry: false,
  });
  return data?.canManage ? data : null;
}
