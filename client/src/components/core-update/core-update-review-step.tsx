import type { JSX } from 'react';
import { ArrowRight, DatabaseBackup, Download, ExternalLink, Info, Power, Undo2 } from 'lucide-react';
import type { CoreUpdateManageStatus } from '@shared/core-update';
import { CoreUpdateManualCommand } from './core-update-manual-command';

type Props = {
  status: CoreUpdateManageStatus;
  /** Shown above everything, e.g. "A newer version came out; review it again." */
  notice: string | null;
};

function VersionRow({ status }: { status: CoreUpdateManageStatus }): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <span className="rounded-[var(--npb-radius-input)] bg-npb-surface-inset px-2.5 py-1 font-mono text-sm text-npb-text-secondary">
        {status.installedVersion}
      </span>
      <ArrowRight className="h-4 w-4 text-npb-text-muted" aria-label="to" />
      <span className="rounded-[var(--npb-radius-input)] bg-npb-accent/12 px-2.5 py-1 font-mono text-sm font-medium text-npb-accent">
        {status.latestVersion}
      </span>
      {status.releaseNotesUrl ? (
        <a
          href={status.releaseNotesUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-npb-accent hover:underline"
        >
          Release notes
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}

function WhatHappens({ status }: { status: CoreUpdateManageStatus }): JSX.Element {
  const steps = [
    { icon: DatabaseBackup, text: 'A copy of your database is saved on the server first.' },
    { icon: Download, text: 'The new version downloads while your sites stay online.' },
    { icon: Power, text: `Your sites go offline for ${status.downtime} while NextPress restarts.` },
    { icon: Undo2, text: `If anything goes wrong, NextPress goes back to ${status.installedVersion}.` },
  ];
  return (
    <div className="grid gap-3">
      <p className="text-sm font-medium text-npb-text-primary">What happens</p>
      <ol className="grid gap-2.5">
        {steps.map(({ icon: Icon, text }) => (
          <li key={text} className="flex items-start gap-3 text-sm text-npb-text-secondary">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-npb-surface-inset text-npb-text-muted">
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            {text}
          </li>
        ))}
      </ol>
      <p className="text-sm text-npb-text-muted">Your pages, posts, media and settings stay as they are.</p>
    </div>
  );
}

/** Step 1: what will be installed, what happens, or why this server can't do it from here. */
export function CoreUpdateReviewStep({ status, notice }: Props): JSX.Element {
  const { availability } = status;
  if (!status.updateAvailable || !status.latestVersion) {
    return (
      <p className="text-sm text-npb-text-secondary">
        {status.checkOk
          ? `You have the newest version of NextPress (${status.installedVersion}).`
          : "NextPress couldn't check for new versions right now. Try again in a few minutes."}
      </p>
    );
  }
  return (
    <div className="grid gap-5">
      {notice ? (
        <p className="flex items-start gap-2 rounded-[var(--npb-radius-input)] bg-npb-status-info/10 px-3 py-2 text-sm text-npb-text-primary">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-npb-status-info" aria-hidden />
          {notice}
        </p>
      ) : null}
      <VersionRow status={status} />
      {availability.ready ? (
        <WhatHappens status={status} />
      ) : (
        <div className="grid gap-4">
          <p className="text-sm text-npb-text-secondary">{availability.message}</p>
          {status.manualCommand ? <CoreUpdateManualCommand command={status.manualCommand} /> : null}
        </div>
      )}
    </div>
  );
}
