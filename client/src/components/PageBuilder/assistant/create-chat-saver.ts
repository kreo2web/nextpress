import type { UIMessage } from 'ai';
import type { AssistantChatDocument } from '@shared/assistant-chats';
import { retryFnWithJitter } from '@shared/retry-fn-with-jitter';
import { isRetryableChatError, readChatErrorStatus, saveChat } from './assistant-chats-api';
import type { ChatSummary } from './chat-list';

/** What is wrong with a chat the server has not confirmed. */
export type SaveProblem = 'retrying' | 'too-long' | 'refused';

export type ChatSaverEvents = {
  onSaved: (params: { chatId: string; summary: ChatSummary }) => void;
  /** `null` means the problem is over. */
  onProblem: (params: { chatId: string; problem: SaveProblem | null }) => void;
};

/** Clock and randomness for the retry waits; tests pass fakes so they don't have to wait. */
export type ChatRetryTiming = {
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
};

export type ChatSaver = {
  /** Saves the newest messages of a chat. Calls made while a save is running are folded into it: the newest wins. */
  save: (params: { chatId: string; messages: UIMessage[] }) => void;
  /** The messages of a chat the server has not confirmed yet, or null. The chat is kept here until it is. */
  readUnsaved: (chatId: string) => UIMessage[] | null;
  unsavedIds: () => string[];
  /** Stops saving a chat for good (it was deleted) and resolves once no request for it is still travelling. */
  discard: (chatId: string) => Promise<void>;
  /** The editor closed: no more tries, no more events. */
  dispose: () => void;
};

/**
 * First wait about 2 seconds, growing to about a minute, for as long as the editor stays open. WHY so long:
 * the chat lives in this tab until the server confirms it, and a server that is down for a while should get
 * the chat when it comes back, without the person doing anything.
 */
const SAVE_RETRY = { baseDelayMs: 2000, maxDelayMs: 60_000, maxDurationMs: 6 * 60 * 60_000 } as const;

/** One failed try is usually a blip, so the quiet line waits for the second. */
const QUIET_AFTER_FAILED_TRIES = 2;

type Entry = {
  /** The newest messages not yet confirmed; null once the server has them. */
  pending: UIMessage[] | null;
  isRunning: boolean;
  done: Promise<void> | null;
  stop: AbortController;
};

/** Whatever a `catch` hands over, as an Error (a rejected promise can carry any value). */
export const toError = <Caught>(caught: Caught): Error => (caught instanceof Error ? caught : new Error(String(caught)));

const problemFor = (error: Error): SaveProblem => {
  if (isRetryableChatError(error)) return 'retrying';
  return readChatErrorStatus(error) === 413 ? 'too-long' : 'refused';
};

/**
 * Keeps each chat's newest messages until the server confirms them, retrying with growing, jittered waits.
 * Plain functions and no React: the hook only reacts to the two events.
 */
export function createChatSaver({
  document,
  events,
  send = saveChat,
  timing = {},
}: {
  document: AssistantChatDocument;
  events: ChatSaverEvents;
  send?: typeof saveChat;
  timing?: ChatRetryTiming;
}): ChatSaver {
  const entries = new Map<string, Entry>();
  let isDisposed = false;

  const deliver = (notify: () => void): void => {
    if (!isDisposed) notify();
  };

  const trySaving = async ({ chatId, entry, attempt }: { chatId: string; entry: Entry; attempt: number }): Promise<{ summary: ChatSummary; sent: UIMessage[] }> => {
    // Each try sends whatever is newest by then, so a late reply isn't held back behind an older one.
    const sent = entry.pending;
    if (!sent) throw new Error('This chat has nothing left to save');
    try {
      return { summary: await send({ chatId, document, messages: sent }), sent };
    } catch (caught) {
      const error = toError(caught);
      if (isRetryableChatError(error) && attempt >= QUIET_AFTER_FAILED_TRIES) {
        deliver(() => events.onProblem({ chatId, problem: 'retrying' }));
      }
      throw error;
    }
  };

  const drain = async ({ chatId, entry }: { chatId: string; entry: Entry }): Promise<void> => {
    try {
      while (entry.pending && !entry.stop.signal.aborted) {
        const { summary, sent } = await retryFnWithJitter({
          ...SAVE_RETRY,
          ...timing,
          signal: entry.stop.signal,
          shouldRetry: isRetryableChatError,
          fn: (attempt) => trySaving({ chatId, entry, attempt }),
        });
        if (entry.stop.signal.aborted) return;
        if (entry.pending === sent) entry.pending = null;
        deliver(() => {
          events.onProblem({ chatId, problem: null });
          events.onSaved({ chatId, summary });
        });
      }
    } catch (caught) {
      if (entry.stop.signal.aborted) return;
      const error = toError(caught);
      console.error({
        atFunction: 'createChatSaver',
        data: { siteId: document.siteId, documentId: document.documentId, chatId, status: readChatErrorStatus(error), error },
        message: 'A chat could not be saved to the server; it stays in this editor and the next reply tries again',
      });
      deliver(() => events.onProblem({ chatId, problem: problemFor(error) }));
    } finally {
      entry.isRunning = false;
    }
  };

  return {
    save: ({ chatId, messages }) => {
      if (isDisposed) return;
      const entry = entries.get(chatId) ?? { pending: null, isRunning: false, done: null, stop: new AbortController() };
      entries.set(chatId, entry);
      entry.pending = messages;
      if (entry.isRunning) return;
      entry.isRunning = true;
      entry.done = drain({ chatId, entry });
    },

    readUnsaved: (chatId) => entries.get(chatId)?.pending ?? null,

    unsavedIds: () => [...entries.entries()].filter(([, entry]) => entry.pending !== null).map(([chatId]) => chatId),

    discard: async (chatId) => {
      const entry = entries.get(chatId);
      if (!entry) return;
      entries.delete(chatId);
      entry.pending = null;
      entry.stop.abort();
      await entry.done;
    },

    dispose: () => {
      isDisposed = true;
      entries.forEach((entry) => entry.stop.abort());
    },
  };
}
