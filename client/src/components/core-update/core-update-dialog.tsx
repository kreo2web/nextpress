import { useEffect, useRef, useState, type JSX } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { CircleArrowUp, Loader2, TriangleAlert } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { isCoreUpdateRunActive, type CoreUpdateManageStatus } from '@shared/core-update';
import { CORE_UPDATE_STATUS_KEY, startCoreUpdate, type CoreUpdateStartError } from './core-update-api';
import { followCoreUpdate, type CoreUpdatePhase } from './follow-core-update';
import { forgetPendingCoreUpdate, rememberPendingCoreUpdate } from './core-update-store';
import { CoreUpdateReviewStep } from './core-update-review-step';
import { CORE_UPDATE_PASSWORD_FORM_ID, CoreUpdatePasswordStep } from './core-update-password-step';
import { CoreUpdateProgressStep } from './core-update-progress-step';
import { CoreUpdateResultStep, type CoreUpdateResult } from './core-update-result-step';

type Step =
  | { kind: 'review'; notice: string | null }
  | { kind: 'password' }
  | { kind: 'progress'; requestId: string }
  | { kind: 'result'; result: CoreUpdateResult };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  status: CoreUpdateManageStatus;
};

/** Where the dialog starts: an update under way resumes, a failed one shows what happened, else the review. */
export function initialCoreUpdateStep(status: CoreUpdateManageStatus): Step {
  const { run } = status;
  if (run && isCoreUpdateRunActive(run)) return { kind: 'progress', requestId: run.requestId };
  if (run?.state === 'failed' && status.updateAvailable && run.version === status.latestVersion) {
    return { kind: 'result', result: { kind: 'failed', run } };
  }
  return { kind: 'review', notice: null };
}

/** Codes that mean "look again at what's on offer" rather than "fix your input". */
const REVIEW_AGAIN_CODES = new Set(['version_changed', 'up_to_date', 'not_ready']);

function StepTitle({ step }: { step: Step }): JSX.Element {
  if (step.kind === 'progress') {
    return (
      <>
        <Loader2 className="h-5 w-5 text-npb-accent motion-safe:animate-spin" aria-hidden />
        Updating NextPress
      </>
    );
  }
  if (step.kind === 'result') {
    return (
      <>
        <TriangleAlert className="h-5 w-5 text-npb-status-warning" aria-hidden />
        {step.result.kind === 'failed' ? "The update didn't finish" : 'Update status unknown'}
      </>
    );
  }
  return (
    <>
      <CircleArrowUp className="h-5 w-5 text-npb-accent" aria-hidden />
      Update NextPress
    </>
  );
}

/**
 * One-click NextPress update: review → password → progress → result. The server only leaves a request for the
 * host's update helper; this dialog follows it through the restart and reloads the page when it is done, after
 * which What's New opens by itself.
 */
export function CoreUpdateDialog({ open, onOpenChange, status }: Props): JSX.Element {
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>(() => initialCoreUpdateStep(status));
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState<CoreUpdatePhase>('waiting');
  const [liveStatus, setLiveStatus] = useState<CoreUpdateManageStatus | null>(null);

  // Every time the dialog opens, start again from what the server says now.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setStep(initialCoreUpdateStep(status));
      setPassword('');
      setError(null);
      setPhase('waiting');
      setLiveStatus(null);
    }
    wasOpen.current = open;
  }, [open, status]);

  const followingId = step.kind === 'progress' ? step.requestId : null;
  useEffect(() => {
    if (!open || !followingId) return undefined;
    const controller = new AbortController();
    void followCoreUpdate({
      requestId: followingId,
      signal: controller.signal,
      onProgress: (progress) => {
        setPhase(progress.phase);
        if (progress.status) setLiveStatus(progress.status);
      },
    }).then((outcome) => {
      if (controller.signal.aborted || outcome.kind === 'aborted') return;
      if (outcome.kind === 'signed_out') {
        window.location.reload();
        return;
      }
      if (outcome.kind === 'lost_track') {
        setStep({ kind: 'result', result: { kind: 'lost_track' } });
        return;
      }
      const run = outcome.status.run;
      if (run?.state === 'done') {
        // The new version is serving: load its admin. What's New opens after the reload.
        window.location.reload();
        return;
      }
      forgetPendingCoreUpdate();
      setLiveStatus(outcome.status);
      queryClient.setQueryData(CORE_UPDATE_STATUS_KEY, outcome.status);
      if (run) setStep({ kind: 'result', result: { kind: 'failed', run } });
    });
    return () => controller.abort();
  }, [open, followingId, queryClient]);

  const current = liveStatus ?? status;
  const liveRun = current.run;
  const canClose =
    step.kind !== 'progress' ||
    (phase === 'waiting' && liveRun?.requestId === step.requestId && liveRun.state === 'requested' && liveRun.slow);
  const canContinue = status.availability.ready && status.updateAvailable && Boolean(status.latestVersion);

  const start = async (): Promise<void> => {
    if (!status.latestVersion) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await startCoreUpdate({ password, expectedVersion: status.latestVersion });
      queryClient.setQueryData(CORE_UPDATE_STATUS_KEY, response.status);
      setPassword('');
      const run = response.status.run;
      if (run && isCoreUpdateRunActive(run)) {
        rememberPendingCoreUpdate({ requestId: run.requestId, fromVersion: response.status.installedVersion, toVersion: run.version });
        setLiveStatus(response.status);
        setPhase('waiting');
        setStep({ kind: 'progress', requestId: run.requestId });
      } else {
        setStep(initialCoreUpdateStep(response.status));
      }
    } catch (caught) {
      const failure = caught as CoreUpdateStartError;
      console.warn('[core-update] Update was not started', { atFunction: 'CoreUpdateDialog.start', code: failure.code, status: failure.status, error: failure });
      if (failure.code && REVIEW_AGAIN_CODES.has(failure.code)) {
        setPassword('');
        setStep({ kind: 'review', notice: failure.message });
        await queryClient.invalidateQueries({ queryKey: CORE_UPDATE_STATUS_KEY });
      } else {
        setError(failure.message || "The update couldn't be started. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !canClose) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-lg" showCloseButton={canClose} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <StepTitle step={step} />
          </DialogTitle>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto">
          {step.kind === 'review' ? <CoreUpdateReviewStep status={status} notice={step.notice} /> : null}
          {step.kind === 'password' ? (
            <CoreUpdatePasswordStep
              version={status.latestVersion ?? ''}
              password={password}
              onPasswordChange={(next) => {
                setPassword(next);
                if (error) setError(null);
              }}
              onSubmit={() => void start()}
              error={error}
              submitting={submitting}
            />
          ) : null}
          {step.kind === 'progress' ? (
            <CoreUpdateProgressStep
              version={liveRun?.version ?? status.latestVersion ?? ''}
              downtime={current.downtime}
              phase={phase}
              status={liveStatus ?? (status.run?.requestId === step.requestId ? status : null)}
              requestId={step.requestId}
            />
          ) : null}
          {step.kind === 'result' ? <CoreUpdateResultStep result={step.result} status={current} /> : null}
        </div>

        <DialogFooter className="items-center">
          {step.kind === 'review' ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {canContinue ? 'Cancel' : 'Close'}
              </Button>
              {canContinue ? (
                <Button type="button" onClick={() => setStep({ kind: 'password' })}>
                  Continue
                </Button>
              ) : null}
            </>
          ) : null}
          {step.kind === 'password' ? (
            <>
              <Button type="button" variant="outline" onClick={() => setStep({ kind: 'review', notice: null })} disabled={submitting}>
                Back
              </Button>
              <Button type="submit" form={CORE_UPDATE_PASSWORD_FORM_ID} disabled={!password || submitting}>
                {submitting ? 'Starting…' : 'Update now'}
              </Button>
            </>
          ) : null}
          {step.kind === 'progress' ? (
            <>
              <p className="mr-auto text-sm text-npb-text-muted">This page reloads by itself when the update is done.</p>
              {canClose ? (
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Close
                </Button>
              ) : null}
            </>
          ) : null}
          {step.kind === 'result' ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              {step.result.kind === 'lost_track' ? (
                <Button type="button" onClick={() => window.location.reload()}>
                  Reload page
                </Button>
              ) : canContinue ? (
                <Button type="button" onClick={() => setStep({ kind: 'review', notice: null })}>
                  Try again
                </Button>
              ) : null}
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
