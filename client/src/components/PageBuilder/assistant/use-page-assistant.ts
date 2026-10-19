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
import { loadAssistantMessages, saveAssistantMessages, STORED_MESSAGE_LIMIT, clearAssistantMessages } from './assistant-storage';
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
  clearChat: () => void;
};

type OpenRun = { before: BlockConfig[]; started: boolean; summary: AiPageChangeSummary };

/** Chat messages with the one data part the server streams: `data-page-change`. */
type AssistantMessage = UIMessage<undefined, { 'page-change': AiPageChangeData }>;

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

/**
 * The in-editor assistant for one page. Each request is one undo step: the first change it streams
 * opens a history step and every later change of the same run replaces it, so one Undo goes back to
 * the page as it was. Saving stays the person's; nothing here writes to the server's page.
 */
export function usePageAssistant({ siteId, pageId, contentType, getBlocks, applyBlocks }: UsePageAssistantParams): PageAssistant {
  const runRef = useRef<OpenRun | null>(null);
  const focusRef = useRef<string | null>(null);
  const [focusBlockId, setFocusBlockId] = useState<string | null>(null);
  const [checkpoints, setCheckpoints] = useState<Record<string, AssistantCheckpoint>>({});
  const [latestCheckpointId, setLatestCheckpointId] = useState<string | null>(null);

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

  const initialMessages = useMemo(() => loadAssistantMessages(pageId) as AssistantMessage[], [pageId]);

  const openRun = useCallback((): OpenRun => {
    const run = { before: structuredClone(requestRef.current.getBlocks()), started: false, summary: EMPTY_CHANGE_SUMMARY };
    runRef.current = run;
    return run;
  }, []);

  const chat = useChat<AssistantMessage>({
    id: `page-assistant:${pageId}`,
    messages: initialMessages,
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
      saveAssistantMessages({ pageId: requestRef.current.pageId, messages });
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

  const clearChat = useCallback(() => {
    if (isLocked) return;
    chat.setMessages([]);
    clearAssistantMessages(requestRef.current.pageId);
    setCheckpoints({});
    setLatestCheckpointId(null);
  }, [chat, isLocked]);

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
    clearChat,
  };
}
