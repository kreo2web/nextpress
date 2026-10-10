import type { JSX } from 'react';
import { TriangleAlert } from 'lucide-react';
import type { CoreUpdateManageStatus, CoreUpdateRun } from '@shared/core-update';
import { CoreUpdateManualCommand } from './core-update-manual-command';

export type CoreUpdateResult = { kind: 'failed'; run: CoreUpdateRun } | { kind: 'lost_track' };

type Props = { result: CoreUpdateResult; status: CoreUpdateManageStatus };

/** Step 4 when it went wrong: what happened, what is running now, and the one thing to do next. */
export function CoreUpdateResultStep({ result, status }: Props): JSX.Element {
  const headline =
    result.kind === 'failed'
      ? result.run.message
      : "We lost track of the update. Reload this page in a few minutes to see how it went.";
  const logPath = result.kind === 'failed' ? result.run.logPath : null;
  const touchedDatabase = result.kind === 'failed' && result.run.failedWhileInstalling;

  return (
    <div className="grid gap-4">
      <div className="flex items-start gap-3 rounded-[var(--npb-radius-input)] bg-npb-status-warning/10 p-3">
        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-npb-status-warning" aria-hidden />
        <p className="text-sm text-npb-text-primary">{headline}</p>
      </div>
      <ul className="grid gap-1.5 text-sm text-npb-text-secondary">
        <li>Your sites are running NextPress {status.installedVersion}.</li>
        {touchedDatabase ? <li>Before any change to your database, a copy was saved on the server.</li> : null}
      </ul>
      {status.manualCommand ? <CoreUpdateManualCommand command={status.manualCommand} label="To update by hand, run this on your server:" /> : null}
      {logPath ? (
        <p className="text-xs text-npb-text-muted">
          Details for whoever looks after the server: <span className="break-all font-mono">{logPath}</span>
        </p>
      ) : null}
    </div>
  );
}
