import type { JSX } from 'react';
import { CircleArrowUp, ExternalLink, Loader2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { openCoreUpdateDialog } from './core-update-store';
import { describeUpdateNotice, type CoreUpdateNotice } from './update-notice';
import { useCoreUpdateStatus } from './use-core-update-status';

const TONE_ICON: Record<CoreUpdateNotice['tone'], JSX.Element> = {
  available: <CircleArrowUp className="h-5 w-5" aria-hidden />,
  running: <Loader2 className="h-5 w-5 motion-safe:animate-spin" aria-hidden />,
  problem: <TriangleAlert className="h-5 w-5" aria-hidden />,
};

/**
 * Quiet one-row notice for the dashboard, shown only to main-site admins and only when there is something to do:
 * a newer release, an update under way, or one that didn't finish. The button opens the shared update dialog.
 */
export function CoreUpdateDashboardNotice(): JSX.Element | null {
  const status = useCoreUpdateStatus();
  const notice = status ? describeUpdateNotice(status) : null;
  if (!status || !notice) return null;

  return (
    <section
      aria-label="NextPress update"
      className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[var(--npb-radius-surface)] bg-npb-surface-raised p-4 shadow-[var(--npb-shadow-surface)]"
    >
      <span
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--npb-radius-input)]',
          notice.tone === 'problem' ? 'bg-npb-status-warning/15 text-npb-status-warning' : 'bg-npb-accent/12 text-npb-accent',
        )}
      >
        {TONE_ICON[notice.tone]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-npb-text-primary">{notice.headline}</p>
        <p className="mt-0.5 text-sm text-npb-text-secondary">{notice.detail}</p>
      </div>
      <div className="flex items-center gap-2">
        {notice.tone === 'available' && status.releaseNotesUrl ? (
          <Button variant="ghost" size="sm" asChild>
            <a href={status.releaseNotesUrl} target="_blank" rel="noopener noreferrer">
              Release notes
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
            </a>
          </Button>
        ) : null}
        <Button size="sm" variant={notice.tone === 'available' ? 'default' : 'outline'} onClick={openCoreUpdateDialog}>
          {notice.action}
        </Button>
      </div>
    </section>
  );
}
