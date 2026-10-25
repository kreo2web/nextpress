import type { UIMessage } from 'ai';
import type { AssistantChatDocument, AssistantChatSummary } from '@shared/assistant-chats';
import { apiRequest } from '@/lib/queryClient';

const CHATS_URL = '/api/assistant/chats';

const SUMMARY_FIELDS = ['id', 'title', 'createdAt', 'updatedAt'] as const;

const isChatSummary = (value: object): value is AssistantChatSummary =>
  SUMMARY_FIELDS.every((field) => typeof (value as Record<string, string>)[field] === 'string');

const isStoredMessage = (value: object): value is UIMessage =>
  'id' in value && 'role' in value && 'parts' in value && Array.isArray(value.parts);

/** An answer the server gave in a shape this editor doesn't know: a proxy page, or an older server. */
const unexpectedAnswer = (what: string): Error => new Error(`The server's answer about ${what} was not in the expected shape`);

/** The saved chats for one page or post: id, title and times, newest first. */
export const fetchChatList = async ({ document }: { document: AssistantChatDocument }): Promise<AssistantChatSummary[]> => {
  const query = new URLSearchParams({ siteId: document.siteId, documentKind: document.documentKind, documentId: document.documentId });
  const response = await apiRequest('GET', `${CHATS_URL}?${query.toString()}`);
  const body = (await response.json()) as { chats?: object[] };
  if (!Array.isArray(body.chats)) throw unexpectedAnswer('the saved chats');
  return body.chats.filter(isChatSummary);
};

/** One saved chat with its messages. */
export const fetchChat = async ({ chatId }: { chatId: string }): Promise<{ summary: AssistantChatSummary; messages: UIMessage[] }> => {
  const response = await apiRequest('GET', `${CHATS_URL}/${encodeURIComponent(chatId)}`);
  const body = (await response.json()) as { chat?: object & { messages?: object[] } };
  const chat = body.chat;
  const messages = chat?.messages;
  if (!chat || !isChatSummary(chat) || !Array.isArray(messages)) throw unexpectedAnswer('a saved chat');
  return { summary: chat, messages: messages.filter(isStoredMessage) };
};

/**
 * Creates or updates a chat. WHY a PUT to an id the editor chose: sending the same chat twice (a retry after a
 * lost answer) then changes nothing, so a retry can never leave a duplicate.
 */
export const saveChat = async ({
  chatId,
  document,
  messages,
}: {
  chatId: string;
  document: AssistantChatDocument;
  messages: UIMessage[];
}): Promise<AssistantChatSummary> => {
  const response = await apiRequest('PUT', `${CHATS_URL}/${encodeURIComponent(chatId)}`, { ...document, messages });
  const body = (await response.json()) as { chat?: object };
  if (!body.chat || !isChatSummary(body.chat)) throw unexpectedAnswer('a saved chat');
  return body.chat;
};

export const removeSavedChat = async ({ chatId }: { chatId: string }): Promise<void> => {
  await apiRequest('DELETE', `${CHATS_URL}/${encodeURIComponent(chatId)}`);
};

/** The HTTP status a failed call carried, or null when the server could not be reached at all. */
export const readChatErrorStatus = (error: Error | null): number | null => {
  const status = (error as (Error & { status?: number }) | null)?.status;
  return typeof status === 'number' ? status : null;
};

/**
 * Whether trying the same call again can help. An unreachable server, a busy one and a slow one can recover;
 * "not allowed", "not found" and "too long" will answer the same way every time.
 */
export const isRetryableChatError = (error: Error): boolean => {
  const status = readChatErrorStatus(error);
  return status === null || status === 408 || status === 429 || status >= 500;
};
