import type { UIMessage } from 'ai';

/*
 * What the assistant still keeps in this browser:
 *  - the description "Describe your page" leaves for the editor (session storage), and
 *  - chats saved here before they lived on the server. Those are only read to be moved to the server once
 *    (move-browser-chats.ts), and each is removed here only after the server has confirmed it.
 * Nothing else about chats is stored in the browser any more.
 */

const chatsKey = (pageId: string): string => `page-builder:assistant:chats:${pageId}`;
const chatKey = ({ pageId, chatId }: { pageId: string; chatId: string }): string => `page-builder:assistant:chat:${pageId}:${chatId}`;
/** The first version's single-chat key. */
const legacyKey = (pageId: string): string => `page-builder:assistant:${pageId}`;
const pendingKey = (pageId: string): string => `page-builder:assistant:start:${pageId}`;

/** Stands for the first version's single chat, which has no id of its own. */
export const LEGACY_CHAT_ID = 'legacy';

/** A chat found in this browser. `updatedAt` orders the move, oldest first. */
export type LeftoverChat = { chatId: string; updatedAt: string; messages: UIMessage[] };

type IndexEntry = { id: string; updatedAt: string };

const isStoredMessage = (value: object): value is UIMessage =>
  'id' in value && 'role' in value && 'parts' in value && Array.isArray(value.parts);

const isIndexEntry = (value: object): value is IndexEntry =>
  'id' in value && typeof value.id === 'string' && 'updatedAt' in value && typeof value.updatedAt === 'string';

/**
 * Runs one browser-storage call. WHY: a browser that blocks site data (some private windows,
 * locked-down profiles) throws on any storage access, and this is read while the editor
 * renders, so an unguarded read would take the whole editor down. Losing the saved data is fine.
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

const readIndex = (pageId: string): IndexEntry[] => {
  const raw = localStorage.getItem(chatsKey(pageId));
  return raw ? parseJsonArray(raw).filter(isIndexEntry) : [];
};

const readMessages = ({ pageId, chatId }: { pageId: string; chatId: string }): UIMessage[] => {
  const raw = localStorage.getItem(chatKey({ pageId, chatId }));
  return raw ? parseJsonArray(raw).filter(isStoredMessage) : [];
};

const readLegacyChat = (pageId: string): LeftoverChat[] => {
  const raw = localStorage.getItem(legacyKey(pageId));
  const messages = raw ? parseJsonArray(raw).filter(isStoredMessage) : [];
  return messages.length === 0 ? [] : [{ chatId: LEGACY_CHAT_ID, updatedAt: new Date(0).toISOString(), messages }];
};

/**
 * The chats this browser holds for one page or post, oldest first, so the move keeps their order. The first
 * version's single chat only counts when there is no chat list, as before: next to a list it is a stale copy.
 * Damaged data reads as nothing and is left alone.
 */
export const readLeftoverChats = (pageId: string): LeftoverChat[] =>
  withStorage({
    atFunction: 'readLeftoverChats',
    data: { pageId },
    fallback: [],
    run: () => {
      const index = readIndex(pageId);
      if (index.length === 0) return readLegacyChat(pageId);
      return index
        .map((entry) => ({ chatId: entry.id, updatedAt: entry.updatedAt, messages: readMessages({ pageId, chatId: entry.id }) }))
        .filter((chat) => chat.messages.length > 0)
        .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
    },
  });

/** Drops list rows whose chat is gone, and the list itself once nothing is left. */
const pruneIndex = (pageId: string): void => {
  const kept = readIndex(pageId).filter((entry) => localStorage.getItem(chatKey({ pageId, chatId: entry.id })) !== null);
  if (kept.length === 0) localStorage.removeItem(chatsKey(pageId));
  else localStorage.setItem(chatsKey(pageId), JSON.stringify(kept));
};

/** Removes one chat from this browser. Call it only after the server has confirmed the chat. */
export const removeLeftoverChat = ({ pageId, chatId }: { pageId: string; chatId: string }): void =>
  withStorage({
    atFunction: 'removeLeftoverChat',
    data: { pageId, chatId },
    fallback: undefined,
    run: () => {
      if (chatId === LEGACY_CHAT_ID) {
        localStorage.removeItem(legacyKey(pageId));
        return;
      }
      localStorage.removeItem(chatKey({ pageId, chatId }));
      pruneIndex(pageId);
    },
  });

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
