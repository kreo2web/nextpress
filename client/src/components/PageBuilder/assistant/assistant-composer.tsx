import type { ReactElement } from 'react';
import { SquareIcon } from 'lucide-react';
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input';
import type { ChatStatus } from 'ai';

export type AssistantComposerProps = {
  status: ChatStatus;
  isWorking: boolean;
  /** Why sending is off right now (waiting for an answer, no settings); shown beside the button. */
  blockedReason?: string | null;
  placeholder: string;
  autoFocus?: boolean;
  onSend: (text: string) => void;
  onStop: () => void;
};

/** The message box. While a run streams, its button stops the run instead of sending. */
export function AssistantComposer({
  status,
  isWorking,
  blockedReason = null,
  placeholder,
  autoFocus = false,
  onSend,
  onStop,
}: AssistantComposerProps): ReactElement {
  const canSend = !isWorking && !blockedReason;

  return (
    <PromptInput
      onSubmit={({ text }) => {
        if (canSend) onSend(text);
      }}
      className="rounded-[var(--npb-radius-surface)] bg-npb-surface-raised">
      <PromptInputBody>
        <PromptInputTextarea
          placeholder={placeholder}
          autoFocus={autoFocus}
          aria-label="Message to the assistant"
          className="min-h-16 text-sm"
        />
      </PromptInputBody>
      <PromptInputFooter>
        <PromptInputTools>
          {blockedReason ? (
            <span className="px-2 text-xs text-npb-text-muted" role="status">
              {blockedReason}
            </span>
          ) : (
            <span className="px-2 text-xs text-npb-text-muted">Enter to send, Shift+Enter for a new line</span>
          )}
        </PromptInputTools>
        {isWorking ? (
          <PromptInputSubmit type="button" status={status} onClick={onStop} aria-label="Stop the assistant">
            <SquareIcon className="size-4" aria-hidden />
          </PromptInputSubmit>
        ) : (
          <PromptInputSubmit status={status} disabled={!canSend} aria-label="Send" />
        )}
      </PromptInputFooter>
    </PromptInput>
  );
}
