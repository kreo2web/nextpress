import { memo, type ReactElement } from 'react';
import { getToolName, isToolUIPart, type UIMessage } from 'ai';
import { CheckIcon, CircleAlertIcon, Loader2Icon, RotateCcwIcon } from 'lucide-react';
import { Message, MessageContent, MessageResponse } from '@/components/ai-elements/message';
import {
  Confirmation,
  ConfirmationAccepted,
  ConfirmationAction,
  ConfirmationActions,
  ConfirmationRejected,
  ConfirmationRequest,
  ConfirmationTitle,
} from '@/components/ai-elements/confirmation';
import { Checkpoint, CheckpointIcon, CheckpointTrigger } from '@/components/ai-elements/checkpoint';
import type { AssistantCheckpoint } from './use-page-assistant';
import { describeToolStep } from './assistant-words';

type ToolPart = Extract<UIMessage['parts'][number], { toolCallId: string }>;

const isDone = (part: ToolPart): boolean =>
  part.state === 'output-available' || part.state === 'output-error' || part.state === 'output-denied';

function ToolStep({ part }: { part: ToolPart }): ReactElement {
  const done = isDone(part);
  const label = describeToolStep({
    toolName: getToolName(part),
    input: typeof part.input === 'object' && part.input !== null ? part.input : undefined,
    done,
  });
  const failed = part.state === 'output-error';
  return (
    <li className="flex items-center gap-2 text-xs text-npb-text-muted">
      {failed ? (
        <CircleAlertIcon className="size-3.5 shrink-0 text-npb-status-warning" aria-hidden />
      ) : done ? (
        <CheckIcon className="size-3.5 shrink-0" aria-hidden />
      ) : (
        <Loader2Icon className="size-3.5 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
      )}
      <span className="min-w-0 truncate">{label}</span>
    </li>
  );
}

const CONFIRM_BUTTON_CLASS = 'h-8 min-w-fit flex-1 px-3 text-sm';

function RemovalConfirmation({
  part,
  onAnswer,
}: {
  part: ToolPart;
  onAnswer: (params: { approvalId: string; approved: boolean }) => void;
}): ReactElement | null {
  if (!part.approval) return null;
  const approvalId = part.approval.id;
  return (
    <Confirmation approval={part.approval} state={part.state} className="text-sm">
      <ConfirmationTitle>
        <ConfirmationRequest>This change removes more than ten blocks. Go ahead?</ConfirmationRequest>
        <ConfirmationAccepted>You said yes. The blocks were removed.</ConfirmationAccepted>
        <ConfirmationRejected>You said no. Nothing was removed.</ConfirmationRejected>
      </ConfirmationTitle>
      {/* The sidebar is narrow: the two buttons share the row and wrap instead of running off the edge. */}
      <ConfirmationActions className="w-full flex-wrap">
        <ConfirmationAction variant="outline" className={CONFIRM_BUTTON_CLASS} onClick={() => onAnswer({ approvalId, approved: false })}>
          Keep them
        </ConfirmationAction>
        <ConfirmationAction className={CONFIRM_BUTTON_CLASS} onClick={() => onAnswer({ approvalId, approved: true })}>
          Remove them
        </ConfirmationAction>
      </ConfirmationActions>
    </Confirmation>
  );
}

export type AssistantMessageViewProps = {
  message: UIMessage;
  checkpoint: AssistantCheckpoint | null;
  canRestore: boolean;
  onRestore: (messageId: string) => void;
  onAnswer: (params: { approvalId: string; approved: boolean }) => void;
};

/** One turn of the conversation. Text first, then the steps the assistant took, then what changed. */
export const AssistantMessageView = memo(function AssistantMessageView({
  message,
  checkpoint,
  canRestore,
  onRestore,
  onAnswer,
}: AssistantMessageViewProps): ReactElement {
  const text = message.parts
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join('\n\n')
    .trim();
  const tools = message.parts.filter(isToolUIPart) as ToolPart[];
  const approvals = tools.filter((part) => part.approval);

  return (
    <Message from={message.role}>
      <MessageContent>
        {message.role === 'user' ? <p className="whitespace-pre-wrap text-sm">{text}</p> : null}
        {message.role === 'assistant' && tools.length > 0 ? (
          <ul className="space-y-1" aria-label="What the assistant did">
            {tools.map((part) => (
              <ToolStep key={part.toolCallId} part={part} />
            ))}
          </ul>
        ) : null}
        {message.role === 'assistant' && text !== '' ? <MessageResponse>{text}</MessageResponse> : null}
        {approvals.map((part) => (
          <RemovalConfirmation key={`approval-${part.toolCallId}`} part={part} onAnswer={onAnswer} />
        ))}
      </MessageContent>
      {checkpoint ? (
        <Checkpoint className="text-xs">
          <CheckpointIcon />
          <span className="min-w-0 truncate px-1">{checkpoint.changeLine ?? 'Changed the page.'}</span>
          <CheckpointTrigger
            tooltip="Puts the page back as it was before this reply. You can undo this too."
            disabled={!canRestore}
            onClick={() => onRestore(message.id)}>
            <RotateCcwIcon className="size-3.5" aria-hidden />
            Go back to before this
          </CheckpointTrigger>
        </Checkpoint>
      ) : null}
    </Message>
  );
});
