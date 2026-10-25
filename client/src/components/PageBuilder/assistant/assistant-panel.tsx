import { useEffect, type ReactElement } from 'react';
import { Link } from 'wouter';
import { MessageSquareIcon } from 'lucide-react';
import { Conversation, ConversationContent, ConversationEmptyState, ConversationScrollButton } from '@/components/ai-elements/conversation';
import { Suggestion } from '@/components/ai-elements/suggestion';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AiWorkingStatus } from './ai-working-indicator';
import { AssistantChatHistory } from './assistant-chat-history';
import { AssistantComposer } from './assistant-composer';
import { AssistantMessageView } from './assistant-message-view';
import { NEW_CHAT_TITLE } from '@shared/assistant-chats';
import { usePageAssistantContext, type AssistantAvailability } from './page-assistant-context';

const STARTERS = [
  'Add a hero section with a headline and a button',
  'Add a three-column features section',
  'Add a pricing section with three plans',
  'Make this page work better on phones',
];

const NOTICE: Record<Exclude<AssistantAvailability, 'ready' | 'loading'>, { title: string; body: string }> = {
  'needs-setup': {
    title: 'Set up the assistant',
    body: 'Choose an AI service and add its key, then describe what you want and the assistant builds it here.',
  },
  'ask-admin': {
    title: 'The assistant is off for this site',
    body: 'Ask a site admin to turn on the assistant.',
  },
  unavailable: {
    title: "Couldn't check the assistant",
    body: 'Reload the editor to try again.',
  },
};

function AssistantNotice({ availability }: { availability: Exclude<AssistantAvailability, 'ready' | 'loading'> }): ReactElement {
  const notice = NOTICE[availability];
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
      <MessageSquareIcon className="size-6 text-npb-text-muted" aria-hidden />
      <h3 className="text-sm font-semibold text-npb-text-primary">{notice.title}</h3>
      <p className="text-sm text-npb-text-muted">{notice.body}</p>
      {availability === 'needs-setup' ? (
        <Button asChild size="sm">
          <Link href="/admin/settings?tab=ai">Open Settings → AI</Link>
        </Button>
      ) : null}
    </div>
  );
}

function AssistantPanelSkeleton(): ReactElement {
  return (
    <div className="flex flex-1 flex-col gap-3 p-1" aria-busy="true" aria-label="Loading the assistant">
      <Skeleton className="h-16 w-4/5" />
      <Skeleton className="ml-auto h-10 w-3/5" />
      <div className="flex-1" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}

/**
 * The Assistant tab: the conversation for this page, live steps while it works, and the message box.
 * Works on the whole page; Ask AI on a block's toolbar works on just that block.
 */
export function AssistantPanel(): ReactElement | null {
  const context = usePageAssistantContext();
  const refreshChats = context?.assistant.refreshChats;
  const isReady = context?.availability === 'ready';

  // Opening the tab reads the saved chats; the tab closes its content when you leave it, so this runs each visit.
  useEffect(() => {
    if (isReady) refreshChats?.();
  }, [isReady, refreshChats]);

  if (!context) return null;
  const { assistant, availability } = context;

  if (availability === 'loading') return <AssistantPanelSkeleton />;
  if (availability !== 'ready') return <AssistantNotice availability={availability} />;

  const hasMessages = assistant.messages.length > 0;
  const blockedReason = assistant.isWaitingForAnswer ? 'Answer the question above first.' : null;
  const lockedReason = assistant.isWorking ? 'Wait for the assistant to finish first.' : blockedReason;
  const activeTitle = assistant.chats.find((chat) => chat.id === assistant.activeChatId)?.title ?? NEW_CHAT_TITLE;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-testid="assistant-panel">
      <div className="flex items-center justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold text-npb-text-primary" title={activeTitle}>
          {activeTitle}
        </h3>
        <AssistantChatHistory
          chats={assistant.chats}
          isLoading={assistant.chatsStatus === 'loading'}
          activeChatId={assistant.activeChatId}
          lockedReason={lockedReason}
          onNewChat={assistant.newChat}
          onOpenChat={assistant.openChat}
          onDeleteChat={assistant.deleteChat}
        />
      </div>
      <p className="text-xs text-npb-text-muted">Changes go on the canvas. Save when you're happy.</p>

      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="gap-5 px-0">
          {hasMessages ? (
            assistant.messages.map((message) => (
              <AssistantMessageView
                key={message.id}
                message={message}
                checkpoint={assistant.checkpointFor(message.id)}
                canRestore={!assistant.isLocked}
                onRestore={assistant.restoreCheckpoint}
                onAnswer={assistant.answerApproval}
              />
            ))
          ) : (
            <ConversationEmptyState className="gap-4 px-2 py-6">
              <MessageSquareIcon className="size-6 text-npb-text-muted" aria-hidden />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-npb-text-primary">Describe what you want</h3>
                <p className="text-sm text-npb-text-muted">
                  The assistant adds and changes blocks on this page. Each request is one undo step.
                </p>
              </div>
              <div className="flex w-full flex-col gap-2">
                {STARTERS.map((starter) => (
                  <Suggestion
                    key={starter}
                    suggestion={starter}
                    className="h-auto w-full justify-start whitespace-normal py-2 text-left"
                    onClick={(text) => assistant.send({ text })}
                  />
                ))}
              </div>
            </ConversationEmptyState>
          )}
          {assistant.isWorking ? <AiWorkingStatus step={assistant.liveStep} /> : null}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {assistant.errorText ? (
        <p className="text-sm text-npb-status-error" role="alert">
          {assistant.errorText}
        </p>
      ) : null}

      {assistant.chatsNotice ? (
        <p className="text-xs text-npb-text-muted" role="status">
          {assistant.chatsNotice}
        </p>
      ) : null}
      {assistant.saveNotice ? (
        <p className="text-xs text-npb-text-muted" role="status">
          {assistant.saveNotice}
        </p>
      ) : null}

      <AssistantComposer
        status={assistant.status}
        isWorking={assistant.isWorking}
        blockedReason={blockedReason}
        placeholder="Add a pricing section with three plans…"
        onSend={(text) => assistant.send({ text })}
        onStop={assistant.stop}
      />
    </div>
  );
}
