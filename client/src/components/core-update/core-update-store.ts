import { useCallback, useSyncExternalStore } from 'react';

/**
 * Whether the update dialog is open. One dialog serves the whole admin (it lives with the sidebar notice), and
 * any notice can open it — the dashboard card included — without passing props through the pages.
 */
let dialogOpen = false;
const listeners = new Set<() => void>();

const emit = (): void => listeners.forEach((listener) => listener());

export function setCoreUpdateDialogOpen(next: boolean): void {
  if (dialogOpen === next) return;
  dialogOpen = next;
  emit();
}

export function openCoreUpdateDialog(): void {
  setCoreUpdateDialogOpen(true);
}

export function useCoreUpdateDialogOpen(): [boolean, (next: boolean) => void] {
  const value = useSyncExternalStore(
    useCallback((listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    }, []),
    () => dialogOpen,
    () => false,
  );
  return [value, setCoreUpdateDialogOpen];
}

/**
 * The update this browser started, kept across the reload that follows it so What's New can open afterwards,
 * or the progress view can pick up again if someone reloads mid-update. Per browser, a convenience only.
 */
export type PendingCoreUpdate = { requestId: string; fromVersion: string; toVersion: string };

const PENDING_KEY = 'np:core-update:pending';

export function rememberPendingCoreUpdate(pending: PendingCoreUpdate): void {
  try {
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch (error) {
    console.warn('[core-update] Could not remember the update for after the reload', { atFunction: 'rememberPendingCoreUpdate', requestId: pending.requestId, error });
  }
}

export function readPendingCoreUpdate(): PendingCoreUpdate | null {
  try {
    const raw = window.localStorage.getItem(PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PendingCoreUpdate>;
    const valid =
      typeof parsed.requestId === 'string' && typeof parsed.fromVersion === 'string' && typeof parsed.toVersion === 'string';
    return valid ? (parsed as PendingCoreUpdate) : null;
  } catch (error) {
    console.warn('[core-update] Could not read the remembered update', { atFunction: 'readPendingCoreUpdate', error });
    return null;
  }
}

export function forgetPendingCoreUpdate(): void {
  try {
    window.localStorage.removeItem(PENDING_KEY);
  } catch (error) {
    console.warn('[core-update] Could not clear the remembered update', { atFunction: 'forgetPendingCoreUpdate', error });
  }
}
