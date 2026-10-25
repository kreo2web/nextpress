import { useCallback, useEffect, useRef, useState } from 'react';
import type { UIMessage } from 'ai';
import {
  ASSISTANT_CHAT_MESSAGES,
  deriveChatTitle,
  keepNewestMessages,
  type AssistantChatDocument,
} from '@shared/assistant-chats';
import { generateId } from '@/lib/utils';
import { fetchChat, fetchChatList, readChatErrorStatus, removeSavedChat } from './assistant-chats-api';
import { mergeServerList, upsertChat, withoutChat, type ChatSummary } from './chat-list';
import { createChatSaver, toError, type ChatSaver, type SaveProblem } from './create-chat-saver';
import { moveBrowserChats } from './move-browser-chats';

export type ChatsStatus = 'idle' | 'loading' | 'ready' | 'error';

/** The worst problem wins: a chat that is too long never saves, a refused one is not retried, a retrying one will. */
const PROBLEM_NOTICE: Record<SaveProblem, string> = {
  'too-long': ASSISTANT_CHAT_MESSAGES.tooLong,
  refused: ASSISTANT_CHAT_MESSAGES.saveRefused,
  retrying: ASSISTANT_CHAT_MESSAGES.saveRetrying,
};
const PROBLEM_ORDER: SaveProblem[] = ['too-long', 'refused', 'retrying'];

const readSaveNotice = (problems: Record<string, SaveProblem>): string | null => {
  const worst = PROBLEM_ORDER.find((problem) => Object.values(problems).includes(problem));
  return worst ? PROBLEM_NOTICE[worst] : null;
};

export type SavedChats = {
  chats: ChatSummary[];
  activeChatId: string;
  /** The id of the open chat, read right now (not as of the last render). */
  readActiveChatId: () => string;
  status: ChatsStatus;
  /** A plain line about loading, opening or deleting a chat that went wrong, or null. */
  notice: string | null;
  /** The quiet line shown while a finished reply is not saved on the server yet, or null. */
  saveNotice: string | null;
  /** Moves chats left in this browser to the server (once), then reads the server's list. Resolves to the list, or null when it could not be read. */
  refresh: () => Promise<ChatSummary[] | null>;
  /** Saves the open chat after a finished reply. One request per call, never per streamed word. */
  saveReply: (messages: UIMessage[]) => void;
  startNew: () => void;
  activate: (chatId: string) => void;
  /** The messages of a chat: held here when the server hasn't confirmed it yet, otherwise from the server. Null when they couldn't be read. */
  readMessages: (chatId: string) => Promise<UIMessage[] | null>;
  forget: (chatId: string) => Promise<void>;
};

/**
 * The assistant's chats for one page or post: the list, which chat is open, and saving to the server. Nothing
 * is kept in this browser except what the one-time move is still carrying over.
 */
export function useSavedChats({ document }: { document: AssistantChatDocument }): SavedChats {
  const documentRef = useRef(document);
  documentRef.current = document;

  const [chats, setChats] = useState<ChatSummary[]>([]);
  const chatsRef = useRef<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string>(() => generateId());
  const activeRef = useRef(activeChatId);
  const [status, setStatus] = useState<ChatsStatus>('idle');
  const [notice, setNotice] = useState<string | null>(null);
  const [problems, setProblems] = useState<Record<string, SaveProblem>>({});
  const saverRef = useRef<ChatSaver | null>(null);
  const hasMovedRef = useRef(false);
  /** Chats saved from this editor. Their rows here are newer than any list the server was asked for before the save. */
  const touchedRef = useRef(new Set<string>());

  const commitChats = useCallback((next: ChatSummary[]): void => {
    chatsRef.current = next;
    setChats(next);
  }, []);

  const getSaver = useCallback((): ChatSaver => {
    if (!saverRef.current) {
      saverRef.current = createChatSaver({
        document: documentRef.current,
        events: {
          onSaved: ({ summary }) => commitChats(upsertChat({ chats: chatsRef.current, summary })),
          onProblem: ({ chatId, problem }) =>
            setProblems((current) => {
              const { [chatId]: _previous, ...rest } = current;
              return problem ? { ...rest, [chatId]: problem } : rest;
            }),
        },
      });
    }
    return saverRef.current;
  }, [commitChats]);

  // Leaving the editor stops the retries. A strict-mode remount makes a fresh saver on the next save.
  useEffect(
    () => () => {
      saverRef.current?.dispose();
      saverRef.current = null;
    },
    [],
  );

  const refresh = useCallback(async (): Promise<ChatSummary[] | null> => {
    setStatus((current) => (current === 'ready' ? current : 'loading'));
    setNotice(null);
    if (!hasMovedRef.current) {
      hasMovedRef.current = true;
      await moveBrowserChats({ document: documentRef.current });
    }
    try {
      const server = await fetchChatList({ document: documentRef.current });
      const merged = mergeServerList({ server, local: chatsRef.current, touchedIds: touchedRef.current });
      commitChats(merged);
      setStatus('ready');
      return merged;
    } catch (caught) {
      const error = toError(caught);
      console.error({
        atFunction: 'useSavedChats.refresh',
        data: { ...documentRef.current, status: readChatErrorStatus(error), error },
        message: 'The saved chats could not be loaded',
      });
      setStatus('error');
      setNotice(ASSISTANT_CHAT_MESSAGES.loadFailed);
      return null;
    }
  }, [commitChats, getSaver]);

  const saveReply = useCallback(
    (messages: UIMessage[]): void => {
      if (messages.length === 0) return;
      const chatId = activeRef.current;
      touchedRef.current.add(chatId);
      const kept = keepNewestMessages(messages);
      const now = new Date().toISOString();
      const existing = chatsRef.current.find((chat) => chat.id === chatId);
      // The list shows the chat at once; the server's own row replaces this one when the save is confirmed.
      commitChats(upsertChat({ chats: chatsRef.current, summary: { id: chatId, title: deriveChatTitle(kept), createdAt: existing?.createdAt ?? now, updatedAt: now } }));
      getSaver().save({ chatId, messages: kept });
    },
    [commitChats, getSaver],
  );

  const activate = useCallback((chatId: string): void => {
    activeRef.current = chatId;
    setActiveChatId(chatId);
  }, []);

  const startNew = useCallback((): void => activate(generateId()), [activate]);

  const readMessages = useCallback(async (chatId: string): Promise<UIMessage[] | null> => {
    const unsaved = saverRef.current?.readUnsaved(chatId);
    if (unsaved) return unsaved;
    try {
      return (await fetchChat({ chatId })).messages;
    } catch (caught) {
      const error = toError(caught);
      console.error({
        atFunction: 'useSavedChats.readMessages',
        data: { ...documentRef.current, chatId, status: readChatErrorStatus(error), error },
        message: 'A saved chat could not be opened',
      });
      setNotice(ASSISTANT_CHAT_MESSAGES.openFailed);
      return null;
    }
  }, []);

  const forget = useCallback(
    async (chatId: string): Promise<void> => {
      const removed = chatsRef.current.find((chat) => chat.id === chatId);
      touchedRef.current.delete(chatId);
      commitChats(withoutChat({ chats: chatsRef.current, chatId }));
      await saverRef.current?.discard(chatId);
      try {
        await removeSavedChat({ chatId });
      } catch (caught) {
        const error = toError(caught);
        // A chat the server never received has nothing to delete.
        if (readChatErrorStatus(error) === 404) return;
        console.error({
          atFunction: 'useSavedChats.forget',
          data: { ...documentRef.current, chatId, status: readChatErrorStatus(error), error },
          message: 'A saved chat could not be deleted',
        });
        if (removed) commitChats(upsertChat({ chats: chatsRef.current, summary: removed }));
        setNotice(ASSISTANT_CHAT_MESSAGES.deleteFailed);
      }
    },
    [commitChats],
  );

  return {
    chats,
    activeChatId,
    readActiveChatId: () => activeRef.current,
    status,
    notice,
    saveNotice: readSaveNotice(problems),
    refresh,
    saveReply,
    startNew,
    activate,
    readMessages,
    forget,
  };
}
