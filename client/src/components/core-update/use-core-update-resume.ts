import { useEffect, useRef } from 'react';
import { isCoreUpdateRunActive, type CoreUpdateManageStatus } from '@shared/core-update';
import { showSuccessToast } from '@/lib/sonner-toast';
import { forgetPendingCoreUpdate, readPendingCoreUpdate } from './core-update-store';

/**
 * After the reload that ends an update this browser started: celebrate and open What's New, or reopen the update
 * dialog when the update is still running (someone reloaded mid-way) or did not finish.
 */
export function useCoreUpdateResume({
  status,
  onUpdated,
  onReopen,
}: {
  status: CoreUpdateManageStatus | null;
  onUpdated: () => void;
  onReopen: () => void;
}): void {
  const handled = useRef(false);

  useEffect(() => {
    if (!status || handled.current) return;
    const pending = readPendingCoreUpdate();
    if (!pending) return;
    handled.current = true;

    if (status.installedVersion === pending.toVersion) {
      forgetPendingCoreUpdate();
      showSuccessToast(`NextPress is now on ${pending.toVersion}.`);
      onUpdated();
      return;
    }

    const run = status.run;
    if (run && run.requestId === pending.requestId) {
      if (isCoreUpdateRunActive(run)) {
        onReopen();
        return;
      }
      if (run.state === 'failed') {
        forgetPendingCoreUpdate();
        onReopen();
        return;
      }
    }
    forgetPendingCoreUpdate();
  }, [status, onUpdated, onReopen]);
}
