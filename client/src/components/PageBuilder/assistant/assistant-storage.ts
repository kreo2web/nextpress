import type { UIMessage } from 'ai';

/** Chat text is kept in this browser per page (v1: no server copy), trimmed to the newest turns. */
export const STORED_MESSAGE_LIMIT = 30;

const messagesKey = (pageId: string): string => `page-builder:assistant:${pageId}`;
const pendingKey = (pageId: string): string => `page-builder:assistant:start:${pageId}`;

const isStoredMessage = (value: object): value is UIMessage =>
  'id' in value && 'role' in value && 'parts' in value && Array.isArray((value as UIMessage).parts);

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

/** The saved conversation for a page, or none when there is nothing usable. */
export const loadAssistantMessages = (pageId: string): UIMessage[] =>
  withStorage({
    atFunction: 'loadAssistantMessages',
    data: { pageId },
    fallback: [],
    run: () => {
      const raw = localStorage.getItem(messagesKey(pageId));
      if (!raw) return [];
      const parsed = JSON.parse(raw) as object[];
      return Array.isArray(parsed) ? parsed.filter(isStoredMessage) : [];
    },
  });

export const saveAssistantMessages = ({ pageId, messages }: { pageId: string; messages: UIMessage[] }): void =>
  withStorage({
    atFunction: 'saveAssistantMessages',
    data: { pageId, count: messages.length },
    fallback: undefined,
    run: () => localStorage.setItem(messagesKey(pageId), JSON.stringify(messages.slice(-STORED_MESSAGE_LIMIT))),
  });

export const clearAssistantMessages = (pageId: string): void =>
  withStorage({
    atFunction: 'clearAssistantMessages',
    data: { pageId },
    fallback: undefined,
    run: () => localStorage.removeItem(messagesKey(pageId)),
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
