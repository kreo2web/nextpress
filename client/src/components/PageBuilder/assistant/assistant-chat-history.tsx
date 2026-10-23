import { useState, type ReactElement } from 'react';
import { CheckIcon, HistoryIcon, SquarePenIcon, Trash2Icon } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatRelativeTime } from '@/components/PageBuilder/blocks/post-info/post-info-model';
import type { ChatSummary } from './assistant-storage';

export type AssistantChatHistoryProps = {
  chats: ChatSummary[];
  activeChatId: string;
  /** Why the chat buttons are off right now, or null when they work. Shown as a tooltip. */
  lockedReason: string | null;
  onNewChat: () => void;
  onOpenChat: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
};

/** Disabled buttons don't show their own tooltip, so the reason hangs off a wrapper. */
function LockedHint({ reason, children }: { reason: string | null; children: ReactElement }): ReactElement {
  if (!reason) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The "Chats" list and "New chat" for the assistant header. Deleting asks first, and the confirm dialog
 * sits outside the popover so it stays open after the list closes.
 */
export function AssistantChatHistory({
  chats,
  activeChatId,
  lockedReason,
  onNewChat,
  onOpenChat,
  onDeleteChat,
}: AssistantChatHistoryProps): ReactElement {
  const [isListOpen, setIsListOpen] = useState(false);
  const [chatPendingDelete, setChatPendingDelete] = useState<ChatSummary | null>(null);
  const isLocked = lockedReason !== null;

  const openFromList = (chatId: string): void => {
    setIsListOpen(false);
    onOpenChat(chatId);
  };

  const askToDelete = (chat: ChatSummary): void => {
    setIsListOpen(false);
    setChatPendingDelete(chat);
  };

  return (
    <div className="flex shrink-0 items-center gap-1">
      <LockedHint reason={lockedReason}>
        <Popover open={isListOpen && !isLocked} onOpenChange={setIsListOpen}>
          <PopoverTrigger asChild>
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-npb-text-muted" disabled={isLocked}>
              <HistoryIcon className="size-3.5" aria-hidden />
              Chats
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-1">
            {chats.length === 0 ? (
              <p className="px-2 py-3 text-sm text-npb-text-muted">No saved chats yet. Each chat you start is kept in this browser.</p>
            ) : (
              <ul className="max-h-80 space-y-0.5 overflow-y-auto" aria-label="Saved chats">
                {chats.map((chat) => {
                  const isActive = chat.id === activeChatId;
                  return (
                    <li key={chat.id} className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-current={isActive ? 'true' : undefined}
                        onClick={() => openFromList(chat.id)}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-npb-interactive-bg-hover">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm text-npb-text-primary">{chat.title}</span>
                          <span className="block text-xs text-npb-text-muted">{formatRelativeTime(new Date(chat.updatedAt))}</span>
                        </span>
                        {isActive ? <CheckIcon className="size-3.5 shrink-0 text-npb-text-muted" aria-hidden /> : null}
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-npb-text-muted"
                        aria-label={`Delete chat: ${chat.title}`}
                        onClick={() => askToDelete(chat)}>
                        <Trash2Icon className="size-3.5" aria-hidden />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}
          </PopoverContent>
        </Popover>
      </LockedHint>

      <LockedHint reason={lockedReason}>
        <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-npb-text-muted" disabled={isLocked} onClick={onNewChat}>
          <SquarePenIcon className="size-3.5" aria-hidden />
          New chat
        </Button>
      </LockedHint>

      <AlertDialog open={chatPendingDelete !== null} onOpenChange={(open) => !open && setChatPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription>The page keeps its changes.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => {
                if (chatPendingDelete) onDeleteChat(chatPendingDelete.id);
                setChatPendingDelete(null);
              }}>
              Delete chat
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
