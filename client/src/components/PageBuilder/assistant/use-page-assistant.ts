import { useCallback, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type ChatStatus,
  type UIMessage,
} from 'ai';
import type { AiChatContentType, AiChatRequest, AiPageChangeData, AiPageChangeSummary } from '@shared/ai-builder';
import type { BlockConfig } from '@shared/schema-types';
import {
  createChatId,
  deleteChatFromBrowser,
  loadChatIndex,
  loadChatMessages,
  saveChatToBrowser,
  STORED_MESSAGE_LIMIT,
  type ChatSummary,
} from './assistant-storage';
import {
  EMPTY_CHANGE_SUMMARY,
  describePageChanges,
  describeToolStep,
  mergeChangeSummaries,
  readAssistantError,
} from './assistant-words';
import { flashChangedBlocks } from './flash-changed-blocks';

const CHAT_URL = '/api/ai-builder/chat';
const PAGE_CHANGE_PART = 'data-page-change';

/** Puts a tree on the canvas. `newStep: false` folds it into the step the run already opened. */
export type ApplyAssistantBlocks = (blocks: BlockConfig[], options: { newStep: boolean }) => void;

/** The page as it was before a reply changed it, for "Go back to before this". Kept in memory only. */
export type AssistantCheckpoint = { before: BlockConfig[]; changeLine: string | null };

export type UsePageAssistantParams = {
  siteId: string;
  pageId: string;
  contentType: AiChatContentType;
  getBlocks: () => BlockConfig[];
  applyBlocks: ApplyAssistantBlocks;
};

export type PageAssistant = {
  messages: UIMessage[];
  status: ChatStatus;
  /** A run is streaming: the canvas is read-only and Stop is offered. */
  isWorking: boolean;
  /** The run paused to ask before a big removal; the canvas stays read-only until it is answered. */
  isWaitingForAnswer: boolean;
  isLocked: boolean;
  /** The step the run is on now, e.g. "Adding Heading…". */
  liveStep: string | null;
  errorText: string | null;
  /** The block the latest run is limited to, or null for the whole page. */
  focusBlockId: string | null;
  send: (params: { text: string; focusBlockId?: string | null }) => void;
  stop: () => void;
  answerApproval: (params: { approvalId: string; approved: boolean }) => void;
  checkpointFor: (messageId: string) => AssistantCheckpoint | null;
  restoreCheckpoint: (messageId: string) => void;
  /** The checkpoint of the newest reply that changed the page, for the Ask AI popover's Undo. */
  latestCheckpointId: string | null;
  /** This page's saved chats, newest first. The open chat is listed once its first run finishes. */
  chats: ChatSummary[];
  /** The open chat. A chat that has no saved run yet has an id too, it just isn't in `chats`. */
  activeChatId: string;
  /** Opens an empty chat. The chat being left stays in the list. No-op while the assistant works. */
  newChat: () => void;
  /** Shows a saved chat's messages. Checkpoints from the chat being left are dropped. No-op while locked. */
  openChat: (chatId: string) => void;
  /** Removes a saved chat. Deleting the open chat starts an empty one. No-op while locked. */
  deleteChat: (chatId: string) => void;
};

type OpenRun = { before: BlockConfig[]; started: boolean; summary: AiPageChangeSummary };

/** Chat messages with the one data part the server streams: `data-page-change`. */
type AssistantMessage = UIMessage<undefined, { 'page-change': AiPageChangeData }>;

type StartChat = { chats: ChatSummary[]; activeChatId: string; messages: AssistantMessage[] };

const changedIds = (summary: AiPageChangeSummary): string[] => [...summary.inserted, ...summary.updated, ...summary.replaced, ...summary.moved];

const isAwaitingApproval = (message: UIMessage | undefined): boolean =>
  message?.role === 'assistant' && message.parts.some((part) => isToolUIPart(part) && part.state === 'approval-requested');

/** The newest running tool step of the newest reply, in plain words. */
const readLiveStep = (messages: UIMessage[]): string | null => {
  const last = messages.at(-1);
  if (last?.role !== 'assistant') return null;
  const tool = [...last.parts].reverse().find(isToolUIPart);
  if (!tool) return null;
  return describeToolStep({
    toolName: getToolName(tool),
    input: typeof tool.input === 'object' && tool.input !== null ? tool.input : undefined,
    done: tool.state === 'output-available' || tool.state === 'output-error' || tool.state === 'output-denied',
  });
};

/** Opens the newest saved chat, or an empty one when the page has none yet. */
const readStartChat = (pageId: string): StartChat => {
  const chats = loadChatIndex(pageId);
  const newest = chats[0];
  if (!newest) return { chats, activeChatId: createChatId(), messages: [] };
  return {
    chats,
    activeChatId: newest.id,
    messages: loadChatMessages({ pageId, chatId: newest.id }) as AssistantMessage[],
  };
};

/**
 * The in-editor assistant for one page. Each request is one undo step: the first change it streams
 * opens a history step and every later change of the same run replaces it, so one Undo goes back to
 * the page as it was. Saving stays the person's; nothing here writes to the server's page.
 * Chats are kept in this browser; switching chats swaps the messages in the one chat instance.
 */
export function usePageAssistant({ siteId, pageId, contentType, getBlocks, applyBlocks }: UsePageAssistantParams): PageAssistant {
  const runRef = useRef<OpenRun | null>(null);
  const focusRef = useRef<string | null>(null);
  const [focusBlockId, setFocusBlockId] = useState<string | null>(null);
  const [checkpoints, setCheckpoints] = useState<Record<string, AssistantCheckpoint>>({});
  const [latestCheckpointId, setLatestCheckpointId] = useState<string | null>(null);

  const [startChat] = useState(() => readStartChat(pageId));
  const [chats, setChats] = useState<ChatSummary[]>(startChat.chats);
  const [activeChatId, setActiveChatId] = useState<string>(startChat.activeChatId);
  // Refs mirror the state so the chat callbacks (which the library may hold on to) read the current values.
  const chatsRef = useRef<ChatSummary[]>(startChat.chats);
  const activeChatRef = useRef<string>(startChat.activeChatId);

  const requestRef = useRef({ siteId, pageId, contentType, getBlocks, applyBlocks });
  requestRef.current = { siteId, pageId, contentType, getBlocks, applyBlocks };

  const transport = useMemo(
    () =>
      new DefaultChatTransport<AssistantMessage>({
        api: CHAT_URL,
        credentials: 'include',
        prepareSendMessagesRequest: ({ messages }) => {
          const current = requestRef.current;
          const body: AiChatRequest = {
            siteId: current.siteId,
            pageId: current.pageId,
            contentType: current.contentType,
            blocks: current.getBlocks(),
            ...(focusRef.current ? { focusBlockId: focusRef.current } : {}),
            messages: messages.slice(-STORED_MESSAGE_LIMIT) as AiChatRequest['messages'],
          };
          return { body };
        },
      }),
    [],
  );

  const openRun = useCallback((): OpenRun => {
    const run = { before: structuredClone(requestRef.current.getBlocks()), started: false, summary: EMPTY_CHANGE_SUMMARY };
    runRef.current = run;
    return run;
  }, []);

  const commitChats = useCallback((next: ChatSummary[]): void => {
    chatsRef.current = next;
    setChats(next);
  }, []);

  const chat = useChat<AssistantMessage>({
    id: `page-assistant:${pageId}`,
    messages: startChat.messages,
    transport,
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onData: (part) => {
      if (part.type !== PAGE_CHANGE_PART || !Array.isArray(part.data?.blocks)) return;
      const run = runRef.current ?? openRun();
      requestRef.current.applyBlocks(part.data.blocks, { newStep: !run.started });
      run.started = true;
      run.summary = mergeChangeSummaries(run.summary, part.data.summary);
      flashChangedBlocks(changedIds(part.data.summary));
    },
    onFinish: ({ message, messages, isAbort }) => {
      commitChats(
        saveChatToBrowser({
          pageId: requestRef.current.pageId,
          chatId: activeChatRef.current,
          messages,
          chats: chatsRef.current,
        }),
      );
      if (!isAbort && isAwaitingApproval(message)) return;
      const run = runRef.current;
      runRef.current = null;
      if (!run?.started) return;
      setCheckpoints((current) => ({ ...current, [message.id]: { before: run.before, changeLine: describePageChanges(run.summary) } }));
      setLatestCheckpointId(message.id);
    },
    onError: (error) => {
      console.error({
        atFunction: 'usePageAssistant',
        data: { siteId: requestRef.current.siteId, pageId: requestRef.current.pageId, error },
        message: 'The assistant run failed',
      });
    },
  });

  const isWorking = chat.status === 'submitted' || chat.status === 'streaming';
  const isWaitingForAnswer = !isWorking && isAwaitingApproval(chat.messages.at(-1));
  const isLocked = isWorking || isWaitingForAnswer;

  const send = useCallback<PageAssistant['send']>(
    ({ text, focusBlockId: focus = null }) => {
      const trimmed = text.trim();
      if (trimmed === '' || isLocked) return;
      focusRef.current = focus;
      setFocusBlockId(focus);
      openRun();
      chat.clearError();
      void chat.sendMessage({ text: trimmed });
    },
    [chat, isLocked, openRun],
  );

  const restoreCheckpoint = useCallback(
    (messageId: string) => {
      const checkpoint = checkpoints[messageId];
      if (!checkpoint || isLocked) return;
      requestRef.current.applyBlocks(structuredClone(checkpoint.before), { newStep: true });
    },
    [checkpoints, isLocked],
  );

  /** Points the hook at another chat id. Checkpoints belong to the chat they were made in, so they go too. */
  const showChatId = useCallback((chatId: string): void => {
    activeChatRef.current = chatId;
    setActiveChatId(chatId);
    setCheckpoints({});
    setLatestCheckpointId(null);
  }, []);

  const startEmptyChat = useCallback((): void => {
    showChatId(createChatId());
    chat.setMessages([]);
    chat.clearError();
  }, [chat, showChatId]);

  const newChat = useCallback(() => {
    if (isLocked) return;
    startEmptyChat();
  }, [isLocked, startEmptyChat]);

  const openChat = useCallback(
    (chatId: string) => {
      if (isLocked || chatId === activeChatRef.current) return;
      showChatId(chatId);
      chat.setMessages(loadChatMessages({ pageId: requestRef.current.pageId, chatId }) as AssistantMessage[]);
      chat.clearError();
    },
    [chat, isLocked, showChatId],
  );

  const deleteChat = useCallback(
    (chatId: string) => {
      if (isLocked) return;
      commitChats(deleteChatFromBrowser({ pageId: requestRef.current.pageId, chatId, chats: chatsRef.current }));
      if (chatId === activeChatRef.current) startEmptyChat();
    },
    [commitChats, isLocked, startEmptyChat],
  );

  return {
    messages: chat.messages,
    status: chat.status,
    isWorking,
    isWaitingForAnswer,
    isLocked,
    liveStep: isWorking ? readLiveStep(chat.messages) : null,
    errorText: readAssistantError(chat.error),
    focusBlockId,
    send,
    stop: () => void chat.stop(),
    answerApproval: ({ approvalId, approved }) => void chat.addToolApprovalResponse({ id: approvalId, approved }),
    checkpointFor: (messageId) => checkpoints[messageId] ?? null,
    restoreCheckpoint,
    latestCheckpointId,
    chats,
    activeChatId,
    newChat,
    openChat,
    deleteChat,
  };
}
