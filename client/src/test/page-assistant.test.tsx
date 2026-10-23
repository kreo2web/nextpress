import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiChatRequest, AiPageChangeData } from '@shared/ai-builder';
import type { BlockConfig, Page } from '@shared/schema-types';
import { makeBlock } from '@shared/page-tools/test-support/memory-context';
import PageBuilder from '@/components/PageBuilder/PageBuilder';
import { ThemeProvider } from '@/components/ThemeProvider';
import { TooltipProvider } from '@/components/ui/tooltip';
import { setPendingDescription } from '@/components/PageBuilder/assistant';

const SITE_ID = '3f2b8a40-6c1d-4a57-9e0b-5d7c1a2b9e11';
const PAGE_ID = '9a1c2b3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';

vi.mock('@/hooks/usePageSave', () => ({ usePageSave: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock('@/hooks/useContentLists', () => ({
  useContentLists: () => ({ pages: [], templates: [], posts: [], pagesLoading: false, templatesLoading: false, postsLoading: false }),
}));
vi.mock('@/hooks/useActiveSite', () => ({
  useActiveSite: () => ({ activeSiteId: SITE_ID, sites: [] }),
  useOptionalActiveSite: () => ({ activeSiteId: SITE_ID, sites: [] }),
}));

vi.mock('@/components/PageBuilder/EditorBar/BlogMenu', () => ({ BlogMenu: () => null }));
vi.mock('@/components/PageBuilder/EditorBar/PagesMenu', () => ({ PagesMenu: () => null }));
vi.mock('@/components/PageBuilder/EditorBar/DesignMenu', () => ({ DesignMenu: () => null }));
// The published-page CSS uses `:has(> …)`, which jsdom's selector engine cannot parse. Not under test here.
vi.mock('@/components/PageBuilder/PublishBlockStyles', () => ({ PublishBlockStyles: () => null }));
vi.mock('@/hooks/useBlogs', async (importOriginal) => ({
  ...(await importOriginal<Record<string, object>>()),
}));

const INTRO = makeBlock({ name: 'core/paragraph', id: 'intro', content: { value: 'Welcome to the studio' } });
const PRICING = makeBlock({ name: 'core/heading', id: 'pricing', content: { value: 'Our prices' } });
const PLANS = makeBlock({ name: 'core/paragraph', id: 'plans', content: { value: 'Three plans to pick from' } });

type Chunk = Record<string, string | boolean | object>;

const change = ({ blocks, inserted }: { blocks: BlockConfig[]; inserted: string[] }): Chunk => ({
  type: 'data-page-change',
  transient: true,
  data: { ops: [], summary: { inserted, updated: [], deleted: [], moved: [], replaced: [] }, blocks } satisfies AiPageChangeData,
});

const toolStep = (id: string, extra: Chunk[] = []): Chunk[] => [
  { type: 'start-step' },
  { type: 'tool-input-available', toolCallId: id, toolName: 'change_blocks', input: { ops: [{ op: 'insert', parentId: null, block: { name: 'core/heading' } }] } },
  ...extra,
  { type: 'tool-output-available', toolCallId: id, output: 'Inserted 1 block.' },
  { type: 'finish-step' },
];

const reply = (text: string): Chunk[] => [
  { type: 'start-step' },
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: text },
  { type: 'text-end', id: 't1' },
  { type: 'finish-step' },
];

/** A run that adds a heading, then a paragraph, then says so: two streamed changes. */
const TWO_CHANGE_RUN: Chunk[] = [
  { type: 'start', messageId: 'reply-1' },
  ...toolStep('call-1', [change({ blocks: [INTRO, PRICING], inserted: ['pricing'] })]),
  ...toolStep('call-2', [change({ blocks: [INTRO, PRICING, PLANS], inserted: ['plans'] })]),
  ...reply('I added a pricing heading and a short line about the plans.'),
  { type: 'finish' },
];

const encoder = new TextEncoder();

const sse = (chunks: Chunk[], { keepOpen = false, signal }: { keepOpen?: boolean; signal?: AbortSignal | null } = {}): Response =>
  new Response(
    new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)));
        if (!keepOpen) {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }
        signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')));
      },
    }),
    { headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' } },
  );

const json = (body: object, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

type ChatCall = { body: AiChatRequest; signal: AbortSignal | null };

const installServer = ({
  status = { enabled: true, canManage: true },
  chat = () => TWO_CHANGE_RUN,
  keepOpen = false,
}: {
  status?: { enabled: boolean; canManage: boolean };
  chat?: (call: number) => Chunk[];
  keepOpen?: boolean;
} = {}) => {
  const chatCalls: ChatCall[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input.toString(), 'http://localhost');
      if (url.pathname === '/api/ai-builder/status') return json(status);
      if (url.pathname === '/api/ai-builder/chat') {
        chatCalls.push({ body: JSON.parse(String(init?.body)) as AiChatRequest, signal: init?.signal ?? null });
        return sse(chat(chatCalls.length), { keepOpen, signal: init?.signal });
      }
      return json([]);
    }),
  );
  return { chatCalls };
};

const PAGE = { id: PAGE_ID, siteId: SITE_ID, title: 'Home', slug: 'home', blocks: [INTRO] } as unknown as Page;

/** The tree the editor last handed its parent (what Save and local drafts read). */
let reported: BlockConfig[] = [];
const reportedIds = (): string[] => reported.map((block) => block.id);

const renderEditor = () => {
  reported = [INTRO];
  const onBlocksChange = vi.fn((blocks: BlockConfig[]) => {
    reported = blocks;
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TooltipProvider>
          <PageBuilder post={PAGE} blocks={[INTRO]} onBlocksChange={onBlocksChange} contentType="page" />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return { onBlocksChange };
};

const openAssistantAndAsk = async (text: string) => {
  const user = userEvent.setup();
  await user.click(await screen.findByRole('tab', { name: /assistant/i }));
  const box = await screen.findByRole('textbox', { name: 'Message to the assistant' });
  await user.type(box, `${text}{Enter}`);
  return user;
};

beforeEach(() => localStorage.clear());
afterEach(() => vi.unstubAllGlobals());

describe('the assistant in the editor', () => {
  it('puts streamed changes on the canvas as one undo step, sending the open copy of the page', async () => {
    const { chatCalls } = installServer();
    const { onBlocksChange } = renderEditor();

    const user = await openAssistantAndAsk('Add a pricing section');
    await waitFor(() => expect(reportedIds()).toEqual(['intro', 'pricing', 'plans']));
    expect(await screen.findByText('Added 2 blocks.')).toBeTruthy();

    expect(chatCalls[0]?.body).toMatchObject({ siteId: SITE_ID, pageId: PAGE_ID, contentType: 'page' });
    expect(chatCalls[0]?.body.blocks.map((block) => block.id)).toEqual(['intro']);
    expect(onBlocksChange).toHaveBeenCalledTimes(2);

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(reportedIds()).toEqual(['intro']));
  });

  it('goes back to before a reply from its checkpoint', async () => {
    installServer();
    renderEditor();

    const user = await openAssistantAndAsk('Add a pricing section');
    await waitFor(() => expect(reportedIds()).toEqual(['intro', 'pricing', 'plans']));
    await user.click(await screen.findByRole('button', { name: /go back to before this/i }));
    await waitFor(() => expect(reportedIds()).toEqual(['intro']));
  });

  it('locks the editor while it works, and Stop ends the run and keeps what was applied', async () => {
    const { chatCalls } = installServer({
      keepOpen: true,
      chat: () => [{ type: 'start', messageId: 'reply-1' }, ...toolStep('call-1', [change({ blocks: [INTRO, PRICING], inserted: ['pricing'] })])],
    });
    renderEditor();

    await openAssistantAndAsk('Add a pricing section');
    await waitFor(() => expect(reportedIds()).toEqual(['intro', 'pricing']));
    const frame = document.querySelector('.npb-editor-main');
    expect(frame?.getAttribute('aria-busy')).toBe('true');
    expect(frame?.querySelector('[inert]')).toBeTruthy();

    const user = userEvent.setup();
    await user.click(within(frame as HTMLElement).getByRole('button', { name: 'Stop' }));
    await waitFor(() => expect(chatCalls[0]?.signal?.aborted).toBe(true));
    await waitFor(() => expect(frame?.getAttribute('aria-busy')).toBe('false'));
    expect(reportedIds()).toEqual(['intro', 'pricing']);
  });

  it('asks before a big removal and keeps the editor locked until answered', async () => {
    installServer({
      chat: (): Chunk[] => [
        { type: 'start', messageId: 'reply-1' },
        { type: 'start-step' },
        { type: 'tool-input-available', toolCallId: 'call-1', toolName: 'change_blocks', input: { ops: [{ op: 'delete', id: 'intro' }] } },
        { type: 'tool-approval-request', approvalId: 'approval-1', toolCallId: 'call-1' },
        { type: 'finish-step' },
        { type: 'finish' },
      ],
    });
    renderEditor();

    await openAssistantAndAsk('Clear the page');
    expect(await screen.findByText(/removes more than ten blocks/i)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove them' })).toBeTruthy();
    expect(document.querySelector('.npb-editor-main')?.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByText(/waiting for your answer/i)).toBeTruthy();
  });

  it('starts the run a "Describe your page" description left for this page', async () => {
    const { chatCalls } = installServer();
    setPendingDescription({ pageId: PAGE_ID, description: 'A landing page for a yoga studio' });
    renderEditor();

    await waitFor(() => expect(chatCalls).toHaveLength(1));
    const sent = JSON.stringify(chatCalls[0]?.body.messages);
    expect(sent).toContain('A landing page for a yoga studio');
    await waitFor(() => expect(reportedIds()).toEqual(['intro', 'pricing', 'plans']));
  });

  it('keeps a finished run as a chat: New chat starts empty, and the Chats list brings the run back', async () => {
    installServer();
    renderEditor();

    const user = await openAssistantAndAsk('Add a pricing section');
    await waitFor(() => expect(reportedIds()).toEqual(['intro', 'pricing', 'plans']));
    expect(await screen.findByText('Added 2 blocks.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'New chat' }));
    expect(screen.queryByText('Added 2 blocks.')).toBeNull();
    expect(screen.getByText('Describe what you want')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Chats' }));
    const savedChats = await screen.findByRole('list', { name: 'Saved chats' });
    await user.click(within(savedChats).getByRole('button', { name: /^Add a pricing section/ }));
    expect(await screen.findByText('I added a pricing heading and a short line about the plans.')).toBeTruthy();
    expect(screen.queryByText('Describe what you want')).toBeNull();
    expect(reportedIds()).toEqual(['intro', 'pricing', 'plans']);
  });

  it('deleting a chat asks first, and the page keeps its changes', async () => {
    installServer();
    renderEditor();

    const user = await openAssistantAndAsk('Add a pricing section');
    await waitFor(() => expect(reportedIds()).toEqual(['intro', 'pricing', 'plans']));
    await screen.findByText('Added 2 blocks.');

    await user.click(screen.getByRole('button', { name: 'Chats' }));
    await user.click(await screen.findByRole('button', { name: 'Delete chat: Add a pricing section' }));
    expect(await screen.findByText('Delete this chat?')).toBeTruthy();
    expect(screen.getByText('The page keeps its changes.')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Delete chat' }));
    await waitFor(() => expect(screen.queryByText('Delete this chat?')).toBeNull());
    expect(reportedIds()).toEqual(['intro', 'pricing', 'plans']);

    await user.click(screen.getByRole('button', { name: 'Chats' }));
    expect(await screen.findByText('No saved chats yet. Each chat you start is kept in this browser.')).toBeTruthy();
  });
});

describe('when the assistant is not set up', () => {
  it('sends admins to Settings → AI', async () => {
    installServer({ status: { enabled: false, canManage: true } });
    renderEditor();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: /assistant/i }));
    expect(await screen.findByText('Set up the assistant')).toBeTruthy();
    expect(screen.getByRole('link', { name: /open settings/i }).getAttribute('href')).toContain('/admin/settings?tab=ai');
  });

  it('tells everyone else to ask a site admin', async () => {
    installServer({ status: { enabled: false, canManage: false } });
    renderEditor();
    const user = userEvent.setup();
    await user.click(await screen.findByRole('tab', { name: /assistant/i }));
    expect(await screen.findByText('Ask a site admin to turn on the assistant.')).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Message to the assistant' })).toBeNull();
  });
});
