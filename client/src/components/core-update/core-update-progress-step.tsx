import type { JSX } from 'react';
import { CircleCheck, Circle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CoreUpdateManageStatus, CoreUpdateRun } from '@shared/core-update';
import type { CoreUpdatePhase } from './follow-core-update';
import { CoreUpdateManualCommand } from './core-update-manual-command';

type Props = {
  version: string;
  downtime: string;
  phase: CoreUpdatePhase;
  status: CoreUpdateManageStatus | null;
  requestId: string;
};

type StageState = 'done' | 'active' | 'pending';

/** Which stage is under way, from what the runner last said and whether the server answers. */
export function currentStageIndex({ phase, run }: { phase: CoreUpdatePhase; run: CoreUpdateRun | null }): number {
  if (phase === 'finishing') return 3;
  if (phase === 'restarting') return 2;
  if (!run || run.state === 'requested' || run.step === 'waiting') return 0;
  return run.step === 'download' ? 1 : 2;
}

function StageIcon({ state }: { state: StageState }): JSX.Element {
  if (state === 'done') return <CircleCheck className="h-5 w-5 text-npb-status-success" aria-hidden />;
  if (state === 'active') return <Loader2 className="h-5 w-5 text-npb-accent motion-safe:animate-spin" aria-hidden />;
  return <Circle className="h-5 w-5 text-npb-text-muted" aria-hidden />;
}

/** Step 3: live progress. It keeps going while the server restarts and reloads the page when done. */
export function CoreUpdateProgressStep({ version, downtime, phase, status, requestId }: Props): JSX.Element {
  const run = status?.run && status.run.requestId === requestId ? status.run : null;
  const active = currentStageIndex({ phase, run });
  const stages = [
    { title: 'Getting ready', note: 'The server picks up the update.' },
    { title: `Downloading ${version}`, note: 'Your sites stay online.' },
    { title: 'Installing and restarting', note: `Your sites are offline for ${downtime}.` },
    { title: 'Checking everything works', note: 'Almost done.' },
  ];
  const waitingTooLong = run?.state === 'requested' && run.slow;

  return (
    <div className="grid gap-5">
      <ol className="grid gap-3" aria-label="Update progress">
        {stages.map((stage, index) => {
          const state: StageState = index < active ? 'done' : index === active ? 'active' : 'pending';
          return (
            <li key={stage.title} className="flex items-start gap-3" aria-current={state === 'active' ? 'step' : undefined}>
              <span className="mt-0.5 shrink-0">
                <StageIcon state={state} />
              </span>
              <span className="grid gap-0.5">
                <span className={cn('text-sm font-medium', state === 'pending' ? 'text-npb-text-muted' : 'text-npb-text-primary')}>
                  {stage.title}
                </span>
                {state === 'active' ? <span className="text-sm text-npb-text-secondary">{stage.note}</span> : null}
              </span>
            </li>
          );
        })}
      </ol>
      {waitingTooLong ? (
        <div className="grid gap-3 rounded-[var(--npb-radius-input)] bg-npb-status-warning/10 p-3">
          <p className="text-sm text-npb-text-primary">{run.message}</p>
          {status?.manualCommand ? <CoreUpdateManualCommand command={status.manualCommand} /> : null}
        </div>
      ) : run?.slow ? (
        <p className="text-sm text-npb-text-secondary">{run.message}</p>
      ) : null}
    </div>
  );
}
