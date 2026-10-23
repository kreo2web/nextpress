import { useEffect, useState, type ReactElement, type ReactNode } from 'react';
import type { UIMessage } from 'ai';
import { MessageSquareIcon, RotateCcwIcon, SquareIcon } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AiWorkingStatus } from './ai-working-indicator';
import { AssistantComposer } from './assistant-composer';
import { usePageAssistantContext, type AssistantAvailability } from './page-assistant-context';

/** One tap sends these for the block: short, common asks the owner makes on most blocks. */
const QUICK_CHIPS = ['Make it shorter', 'Make it friendlier', 'Fix it for phones'] as const;

/** Why a notice says what it says; keyed by the readiness value so the copy lives in one place. */
const NOT_READY_NOTICE: Record<Exclude<AssistantAvailability, 'ready'>, ReactNode> = {
  loading: 'Checking the assistant…',
  unavailable: "The assistant can't be reached right now. Try again in a moment.",
  'needs-setup': (
    <>
      Set up the assistant in{' '}
      <Link href="/admin/settings?tab=ai" className="font-medium text-npb-accent underline underline-offset-2">
        Settings → AI
      </Link>
      .
    </>
  ),
  'ask-admin': 'Ask a site admin to turn on the assistant.',
};

const isMacPlatform = (): boolean => /Mac|iPhone|iPad|iPod/.test(navigator.platform);

const askAiShortcutLabel = (): string => (isMacPlatform() ? '⌘J' : 'Ctrl+J');

const isTypingTarget = (target: EventTarget | null): boolean => {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
};

/** Ctrl+J on Windows and Linux, ⌘J on Mac, with no other modifier and not while typing. */
const isAskAiShortcut = ({ event, isMac }: { event: KeyboardEvent; isMac: boolean }): boolean => {
  if (event.altKey || event.shiftKey || event.key.toLowerCase() !== 'j') return false;
  const modifierPressed = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  return modifierPressed && !isTypingTarget(event.target);
};

const lastReplyText = (messages: UIMessage[]): string | null => {
  const last = messages.at(-1);
  if (last?.role !== 'assistant') return null;
  const text = last.parts.flatMap((part) => (part.type === 'text' ? [part.text] : [])).join(' ').trim();
  return text === '' ? null : text;
};

/**
 * "Ask AI" on a block's toolbar: a labeled box next to the block. The run may change only this block and
 * what is inside it (the server refuses anything else). The full thread stays in the Assistant tab.
 * The shortcut lives here, and only the selected block's button listens, so nothing else in the editor changes.
 */
export function AskAiButton({ blockId, blockLabel }: { blockId: string; blockLabel: string }): ReactElement | null {
  const context = usePageAssistantContext();
  const [open, setOpen] = useState(false);
  const [askedHere, setAskedHere] = useState(false);
  const isSelected = context?.selectedBlockId === blockId;

  useEffect(() => {
    if (!isSelected) return undefined;
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (!isAskAiShortcut({ event, isMac: isMacPlatform() })) return;
      event.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isSelected]);

  if (!context) return null;
  const { assistant, availability, selectBlock } = context;
  const shortcut = askAiShortcutLabel();
  const blockedReason = assistant.isWaitingForAnswer
    ? 'Answer the question in the Assistant tab first.'
    : assistant.isLocked
      ? 'The assistant is busy with another request.'
      : null;

  const showResult = askedHere && !assistant.isWorking && assistant.focusBlockId === blockId;
  const reply = showResult ? lastReplyText(assistant.messages) : null;
  const undoId = showResult ? assistant.latestCheckpointId : null;

  const sendForBlock = (text: string): void => {
    setAskedHere(true);
    assistant.send({ text, focusBlockId: blockId });
  };

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
              className="h-6 gap-1 px-1.5 text-xs font-medium text-npb-accent hover:text-npb-accent">
              <MessageSquareIcon className="h-3 w-3" aria-hidden />
              AI
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{`Ask AI to change this block (${shortcut})`}</TooltipContent>
      </Tooltip>
      <PopoverContent
        align="start"
        side="bottom"
        className="w-80 space-y-3 p-3"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-2">
          <MessageSquareIcon className="size-4 shrink-0 text-npb-text-muted" aria-hidden />
          <h3 className="min-w-0 truncate text-sm font-semibold text-npb-text-primary">Ask AI · {blockLabel}</h3>
        </div>

        {availability !== 'ready' ? (
          <p className="text-sm text-npb-text-secondary" role="status">
            {NOT_READY_NOTICE[availability]}
          </p>
        ) : (
          <>
            {assistant.isWorking && askedHere ? (
              <div className="flex items-center justify-between gap-3">
                <AiWorkingStatus step={assistant.liveStep} />
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
              <>
                <AssistantComposer
                  status={assistant.status}
                  isWorking={false}
                  blockedReason={blockedReason}
                  placeholder="Make this shorter and friendlier…"
                  autoFocus
                  onSend={sendForBlock}
                  onStop={assistant.stop}
                />
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_CHIPS.map((text) => (
                    <Button
                      key={text}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={blockedReason !== null}
                      onClick={() => sendForBlock(text)}
                      className="h-7 rounded-full px-2.5 text-xs">
                      {text}
                    </Button>
                  ))}
                </div>
              </>
            ) : null}
            <p className="text-xs text-npb-text-muted">The full chat is in the Assistant tab.</p>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
