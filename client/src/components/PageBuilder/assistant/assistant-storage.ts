import type { UIMessage } from 'ai';

/** Chat text is kept in this browser per chat (no server copy), trimmed to the newest turns. */
export const STORED_MESSAGE_LIMIT = 30;
/** Saved chats per page. WHY: browser storage is small; the oldest chat goes first. */
export const STORED_CHAT_LIMIT = 20;
export const NEW_CHAT_TITLE = 'New chat';
const TITLE_LIMIT = 60;

/** One saved chat in the list. Times are ISO strings so they survive the JSON round trip. */
export type ChatSummary = { id: string; title: string; createdAt: string; updatedAt: string };

export type ChatRef = { pageId: string; chatId: string };

const chatsKey = (pageId: string): string => `page-builder:assistant:chats:${pageId}`;
const chatKey = ({ pageId, chatId }: ChatRef): string => `page-builder:assistant:chat:${pageId}:${chatId}`;
/** The v1 single-chat key. Read once to migrate, then removed. */
const legacyKey = (pageId: string): string => `page-builder:assistant:${pageId}`;
const pendingKey = (pageId: string): string => `page-builder:assistant:start:${pageId}`;

const CHAT_SUMMARY_FIELDS = ['id', 'title', 'createdAt', 'updatedAt'] as const;

const isStoredMessage = (value: object): value is UIMessage =>
  'id' in value && 'role' in value && 'parts' in value && Array.isArray((value as UIMessage).parts);

const isChatSummary = (value: object): value is ChatSummary =>
  CHAT_SUMMARY_FIELDS.every((field) => typeof (value as Record<string, string>)[field] === 'string');

/**
 * Runs one browser-storage call. WHY: a browser that blocks site data (some private windows,
 * locked-down profiles) throws on any storage access, and the chat is read while the editor
 * renders, so an unguarded read would take the whole editor down. Losing the saved chat is fine.
 */
const withStorage = <T>({
  atFunction,
  data,
  fallback,
  run,
}: {
  atFunction: string;
  data: Record<string, string | number>;
  fallback: T;
  run: () => T;
}): T => {
  try {
    return run();
  } catch (error) {
    console.error({ atFunction, data: { ...data, error }, message: 'This browser refused its saved assistant data' });
    return fallback;
  }
};

const parseJsonArray = (raw: string): object[] => {
  const parsed = JSON.parse(raw) as object[];
  return Array.isArray(parsed) ? parsed : [];
};

/** Chat ids only need to be unique within one page's browser storage, so no crypto or secure context is required. */
export const createChatId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** The title is the first thing the person asked, so the list reads like their own words. */
const titleFromMessages = (messages: UIMessage[]): string => {
  const firstUser = messages.find((message) => message.role === 'user');
  const text = (firstUser?.parts ?? [])
    .flatMap((part) => (part.type === 'text' ? [part.text] : []))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text === '') return NEW_CHAT_TITLE;
  return text.length > TITLE_LIMIT ? `${text.slice(0, TITLE_LIMIT - 1).trimEnd()}…` : text;
};

const readChatIndex = (pageId: string): ChatSummary[] =>
  withStorage({
    atFunction: 'loadChatIndex',
    data: { pageId },
    fallback: [],
    run: () => {
      const raw = localStorage.getItem(chatsKey(pageId));
      return raw ? parseJsonArray(raw).filter(isChatSummary) : [];
    },
  });

const writeChatMessages = ({ pageId, chatId }: ChatRef, messages: UIMessage[]): void =>
  localStorage.setItem(chatKey({ pageId, chatId }), JSON.stringify(messages.slice(-STORED_MESSAGE_LIMIT)));

const writeChatIndex = ({ pageId, chats }: { pageId: string; chats: ChatSummary[] }): void =>
  localStorage.setItem(chatsKey(pageId), JSON.stringify(chats));

/**
 * Turns the v1 single chat into one saved chat. WHY: people already have a conversation saved under the
 * old key; it should show up in the list instead of disappearing. The old key goes last, so a failed
 * write leaves it in place for the next load to try again.
 */
const migrateLegacyChat = (pageId: string): ChatSummary[] =>
  withStorage({
    atFunction: 'migrateLegacyChat',
    data: { pageId },
    fallback: [],
    run: () => {
      const raw = localStorage.getItem(legacyKey(pageId));
      if (!raw) return [];
      const messages = parseJsonArray(raw).filter(isStoredMessage);
      if (messages.length === 0) {
        localStorage.removeItem(legacyKey(pageId));
        return [];
      }
      const now = new Date().toISOString();
      const chatId = createChatId();
      const chats: ChatSummary[] = [{ id: chatId, title: titleFromMessages(messages), createdAt: now, updatedAt: now }];
      writeChatMessages({ pageId, chatId }, messages);
      writeChatIndex({ pageId, chats });
      localStorage.removeItem(legacyKey(pageId));
      return chats;
    },
  });

/** This page's saved chats, newest first. Runs the one-time migration when the list is empty. */
export const loadChatIndex = (pageId: string): ChatSummary[] => {
  const chats = readChatIndex(pageId);
  return chats.length > 0 ? chats : migrateLegacyChat(pageId);
};

/** The saved messages of one chat, or none when there is nothing usable. */
export const loadChatMessages = ({ pageId, chatId }: ChatRef): UIMessage[] =>
  withStorage({
    atFunction: 'loadChatMessages',
    data: { pageId, chatId },
    fallback: [],
    run: () => {
      const raw = localStorage.getItem(chatKey({ pageId, chatId }));
      return raw ? parseJsonArray(raw).filter(isStoredMessage) : [];
    },
  });

/**
 * Saves a finished run into its chat and moves that chat to the top of the list. Returns the new list
 * even when browser storage refuses, so the list still shows the chat for this visit.
 */
export const saveChatToBrowser = ({
  pageId,
  chatId,
  messages,
  chats,
  now = new Date().toISOString(),
}: {
  pageId: string;
  chatId: string;
  messages: UIMessage[];
  chats: ChatSummary[];
  now?: string;
}): ChatSummary[] => {
  if (messages.length === 0) return chats;
  const existing = chats.find((chat) => chat.id === chatId);
  const summary: ChatSummary = {
    id: chatId,
    title: titleFromMessages(messages),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
  const next = [summary, ...chats.filter((chat) => chat.id !== chatId)];
  const kept = next.slice(0, STORED_CHAT_LIMIT);
  const dropped = next.slice(STORED_CHAT_LIMIT);
  return withStorage({
    atFunction: 'saveChatToBrowser',
    data: { pageId, chatId, count: messages.length },
    fallback: kept,
    run: () => {
      dropped.forEach((chat) => localStorage.removeItem(chatKey({ pageId, chatId: chat.id })));
      writeChatMessages({ pageId, chatId }, messages);
      writeChatIndex({ pageId, chats: kept });
      return kept;
    },
  });
};

/** Removes a saved chat and its messages. Returns the list without it. */
export const deleteChatFromBrowser = ({ pageId, chatId, chats }: ChatRef & { chats: ChatSummary[] }): ChatSummary[] => {
  const kept = chats.filter((chat) => chat.id !== chatId);
  return withStorage({
    atFunction: 'deleteChatFromBrowser',
    data: { pageId, chatId },
    fallback: kept,
    run: () => {
      localStorage.removeItem(chatKey({ pageId, chatId }));
      writeChatIndex({ pageId, chats: kept });
      return kept;
    },
  });
};

/** "Describe your page": the create dialog leaves the description here, the editor starts the run with it. */
export const setPendingDescription = ({ pageId, description }: { pageId: string; description: string }): void =>
  withStorage({
    atFunction: 'setPendingDescription',
    data: { pageId },
    fallback: undefined,
    run: () => sessionStorage.setItem(pendingKey(pageId), description),
  });

/** Reads the waiting description once, so a reload doesn't start the same run again. */
export const takePendingDescription = (pageId: string): string | null =>
  withStorage({
    atFunction: 'takePendingDescription',
    data: { pageId },
    fallback: null,
    run: () => {
      const key = pendingKey(pageId);
      const description = sessionStorage.getItem(key);
      sessionStorage.removeItem(key);
      return description && description.trim() !== '' ? description : null;
    },
  });
