import type { ReactElement, ReactNode } from 'react';
import { SquareIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePageAssistantContext } from './page-assistant-context';
import { AiWorkingStatus } from './ai-working-indicator';
import { AiFocusHighlight } from './ai-focus-highlight';

/**
 * Wraps the top bar, canvas and settings. While the assistant works (or waits for an answer) they are
 * read-only, so the person and the assistant never edit the same page at once. The assistant panel and
 * the Ask AI box sit outside this frame and stay usable, which is where Stop and the answer live.
 */
export function AssistantLockFrame({ className, children }: { className: string; children: ReactNode }): ReactElement {
  const context = usePageAssistantContext();
  const assistant = context?.assistant;
  const locked = assistant?.isLocked === true;

  return (
    <div className={`relative ${className}`} aria-busy={locked}>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col" inert={locked}>
        {children}
      </div>
      {locked && assistant ? (
        <div
          className="pointer-events-none absolute inset-0 z-10 animate-in fade-in duration-200 motion-reduce:animate-none"
          style={{ backgroundColor: 'color-mix(in srgb, var(--npb-canvas-bg) 35%, transparent)' }}>
          {/* Only the edge glow pulses; the dimming stays still so the page doesn't flicker. */}
          <div
            aria-hidden
            className="npb-ai-pulse pointer-events-none absolute inset-0"
            style={{
              boxShadow: 'inset 0 0 0 1px var(--npb-accent), inset 0 0 48px color-mix(in srgb, var(--npb-accent) 22%, transparent)',
            }}
          />
          {assistant.focusBlockId ? <AiFocusHighlight blockId={assistant.focusBlockId} /> : null}
          <div className="pointer-events-auto absolute bottom-6 left-1/2 flex max-w-[calc(100%-2rem)] -translate-x-1/2 items-center gap-3 rounded-[var(--npb-radius-surface)] bg-npb-surface-raised px-4 py-2.5 shadow-[var(--npb-shadow-surface)]">
            {assistant.isWaitingForAnswer ? (
              <span role="status" aria-live="polite" className="text-sm text-npb-text-secondary">
                The assistant is waiting for your answer in its panel.
              </span>
            ) : (
              <>
                <AiWorkingStatus step={assistant.liveStep} />
                <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1.5" onClick={assistant.stop}>
                  <SquareIcon className="size-3.5" aria-hidden />
                  Stop
                </Button>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
