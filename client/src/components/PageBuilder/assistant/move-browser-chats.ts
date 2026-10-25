import type { AssistantChatDocument } from '@shared/assistant-chats';
import { generateId } from '@/lib/utils';
import { saveChat } from './assistant-chats-api';
import { readLeftoverChats, removeLeftoverChat } from './assistant-storage';

export type MoveBrowserChatsResult = { moved: number; kept: number };

type MoveDeps = {
  send?: typeof saveChat;
  read?: typeof readLeftoverChats;
  remove?: typeof removeLeftoverChat;
};

/**
 * One-time move: chats an older version kept in this browser go up to the server, oldest first so the newest
 * ends up on top. A chat is removed from this browser only after the server has confirmed it; one that fails
 * stays here and is tried again the next time the chats are opened. Ids made in this browser are not valid on
 * the server, so each chat gets a new one.
 */
export async function moveBrowserChats({
  document,
  send = saveChat,
  read = readLeftoverChats,
  remove = removeLeftoverChat,
}: { document: AssistantChatDocument } & MoveDeps): Promise<MoveBrowserChatsResult> {
  const leftovers = read(document.documentId);
  const result: MoveBrowserChatsResult = { moved: 0, kept: 0 };

  for (const leftover of leftovers) {
    try {
      await send({ chatId: generateId(), document, messages: leftover.messages });
      remove({ pageId: document.documentId, chatId: leftover.chatId });
      result.moved += 1;
    } catch (error) {
      result.kept += 1;
      console.error({
        atFunction: 'moveBrowserChats',
        data: { siteId: document.siteId, documentId: document.documentId, chatId: leftover.chatId, error },
        message: 'A chat saved in this browser could not be moved to the server; it stays here and the move is tried again next time',
      });
    }
  }
  return result;
}
