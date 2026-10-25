import { ASSISTANT_CHAT_LIMITS, type AssistantChatSummary } from '@shared/assistant-chats';

export type ChatSummary = AssistantChatSummary;

/** Times are ISO strings in one format, so comparing them as text compares them as times. */
const sortNewestFirst = (chats: ChatSummary[]): ChatSummary[] => [...chats].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

const keepLimit = (chats: ChatSummary[]): ChatSummary[] => chats.slice(0, ASSISTANT_CHAT_LIMITS.chatsPerDocument);

/**
 * Puts a chat at its place in the list (replacing an older row of the same chat), newest first, and keeps the
 * same 20 the server keeps, so the list never shows a chat the server has already let go.
 */
export const upsertChat = ({ chats, summary }: { chats: ChatSummary[]; summary: ChatSummary }): ChatSummary[] =>
  keepLimit(sortNewestFirst([summary, ...chats.filter((chat) => chat.id !== summary.id)]));

export const withoutChat = ({ chats, chatId }: { chats: ChatSummary[]; chatId: string }): ChatSummary[] =>
  chats.filter((chat) => chat.id !== chatId);

/**
 * The server's list, except that chats saved from this editor keep this editor's row. WHY: the list may have
 * been asked for just before a save landed, and a stale answer must not make a chat vanish from the list.
 */
export const mergeServerList = ({
  server,
  local,
  touchedIds,
}: {
  server: ChatSummary[];
  local: ChatSummary[];
  touchedIds: ReadonlySet<string>;
}): ChatSummary[] =>
  keepLimit(sortNewestFirst([...local.filter((chat) => touchedIds.has(chat.id)), ...server.filter((chat) => !touchedIds.has(chat.id))]));
