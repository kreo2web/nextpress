import { useEffect, useState, type ReactElement } from 'react';
import { humanizeDuration } from '@shared/core-update/humanize-duration';
import { Shimmer } from '@/components/ai-elements/shimmer';

const DOT_COUNT = 3;
const DOT_STEP_MS = 160;
const ELAPSED_SHOW_AFTER_MS = 10_000;
const TICK_MS = 1000;

/** Three dots that rise and fade in turn. Motion is CSS only (`npb-ai-dot`), so reduced motion stops it in one place. */
export function AiWorkingDots(): ReactElement {
  return (
    <span className="inline-flex shrink-0 items-center gap-[3px]" aria-hidden>
      {Array.from({ length: DOT_COUNT }, (_, index) => (
        <span
          key={index}
          className="npb-ai-dot size-1.5 rounded-full"
          style={{ background: 'var(--npb-accent)', animationDelay: `${index * DOT_STEP_MS}ms` }}
        />
      ))}
    </span>
  );
}

/**
 * What the assistant is doing right now, plus how long it has been at it. The clock starts when this
 * mounts, and the time only appears after ten seconds so quick edits stay quiet.
 */
export function AiWorkingStatus({ step }: { step: string | null }): ReactElement {
  const [startedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

  const elapsedMs = now - startedAt;
  const elapsedLabel = elapsedMs >= ELAPSED_SHOW_AFTER_MS ? `for ${humanizeDuration(elapsedMs)}` : null;

  return (
    <div className="flex min-w-0 items-center gap-2.5" role="status" aria-live="polite">
      <AiWorkingDots />
      <span className="min-w-0 truncate text-sm text-npb-text-secondary">
        <Shimmer as="span">{step ?? 'The assistant is working…'}</Shimmer>
      </span>
      {elapsedLabel ? <span className="shrink-0 text-xs text-npb-text-muted">{elapsedLabel}</span> : null}
    </div>
  );
}
