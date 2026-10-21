import { useState, type ReactElement } from 'react';
import type { UIMessage } from 'ai';
import { MessageSquareIcon, RotateCcwIcon, SquareIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Shimmer } from '@/components/ai-elements/shimmer';
import { AssistantComposer } from './assistant-composer';
import { usePageAssistantContext } from './page-assistant-context';

const lastReplyText = (messages: UIMessage[]): string | null => {
  const last = messages.at(-1);
  if (last?.role !== 'assistant') return null;
  const text = last.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join(' ').trim();
  return text === '' ? null : text;
};

/**
 * "Ask AI" on a block's toolbar: a small box next to the block. The run may change only this block and
 * what is inside it (the server refuses anything else). The full thread stays in the Assistant tab.
 */
export function AskAiButton({ blockId }: { blockId: string }): ReactElement | null {
  const context = usePageAssistantContext();
  const [open, setOpen] = useState(false);
  const [askedHere, setAskedHere] = useState(false);
  if (!context || context.availability !== 'ready') return null;
  const { assistant, selectBlock } = context;

  const showResult = askedHere && !assistant.isWorking && assistant.focusBlockId === blockId;
  const reply = showResult ? lastReplyText(assistant.messages) : null;
  const undoId = showResult ? assistant.latestCheckpointId : null;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setAskedHere(false);
      }}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              aria-label="Ask AI about this block"
              onClick={(event) => {
                event.stopPropagation();
                selectBlock(blockId);
              }}
              className="h-6 w-6 p-0 text-npb-text-secondary hover:text-npb-text-primary">
              <MessageSquareIcon className="h-3 w-3" aria-hidden />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Ask AI about this block</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-80 space-y-3 p-3"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-2">
          <MessageSquareIcon className="size-4 text-npb-text-muted" aria-hidden />
          <h3 className="text-sm font-semibold text-npb-text-primary">Ask AI about this block</h3>
        </div>

        {assistant.isWorking && askedHere ? (
          <div className="flex items-center justify-between gap-3" role="status" aria-live="polite">
            <span className="min-w-0 truncate text-sm text-npb-text-secondary">
              <Shimmer as="span">{assistant.liveStep ?? 'Working on it…'}</Shimmer>
            </span>
            <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1.5" onClick={assistant.stop}>
              <SquareIcon className="size-3.5" aria-hidden />
              Stop
            </Button>
          </div>
        ) : null}

        {reply ? <p className="text-sm text-npb-text-secondary">{reply}</p> : null}
        {showResult && assistant.errorText ? (
          <p className="text-sm text-npb-status-error" role="alert">
            {assistant.errorText}
          </p>
        ) : null}
        {undoId ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => assistant.restoreCheckpoint(undoId)}>
            <RotateCcwIcon className="size-3.5" aria-hidden />
            Undo this change
          </Button>
        ) : null}

        {!assistant.isWorking ? (
          <AssistantComposer
            status={assistant.status}
            isWorking={false}
            blockedReason={
              assistant.isWaitingForAnswer
                ? 'Answer the question in the Assistant tab first.'
                : assistant.isLocked
                  ? 'The assistant is busy with another request.'
                  : null
            }
            placeholder="Make this shorter and friendlier…"
            autoFocus
            onSend={(text) => {
              setAskedHere(true);
              assistant.send({ text, focusBlockId: blockId });
            }}
            onStop={assistant.stop}
          />
        ) : null}
        <p className="text-xs text-npb-text-muted">The full chat is in the Assistant tab.</p>
      </PopoverContent>
    </Popover>
  );
}
