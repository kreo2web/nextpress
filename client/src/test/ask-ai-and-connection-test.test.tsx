import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AI_ASSISTANT_MESSAGES, type AiChatRequest } from '@shared/ai-builder';
import type { BlockConfig } from '@shared/schema-types';
import { makeBlock } from '@shared/page-tools/test-support/memory-context';
import { AskAiButton, PageAssistantProvider } from '@/components/PageBuilder/assistant';
import { AiConnectionTest } from '@/components/settings/ai-settings/ai-connection-test';
import { TooltipProvider } from '@/components/ui/tooltip';
import { createFakeChatServer } from './fixtures/fake-chat-server';

const SITE_ID = '3f2b8a40-6c1d-4a57-9e0b-5d7c1a2b9e11';
const PAGE_ID = '9a1c2b3d-4e5f-4a6b-8c7d-0e1f2a3b4c5d';
const HERO = makeBlock({ name: 'core/heading', id: 'hero', content: { value: 'Hello' } });
const SHORTER = { ...HERO, content: { ...(HERO.content as object), value: 'Hi' } } as BlockConfig;

const encoder = new TextEncoder();
const sse = (chunks: object[]): Response =>
  new Response(
    new ReadableStream({
      start(controller) {
        chunks.forEach((chunk) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`)));
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
        controller.close();
      },
    }),
    { headers: { 'content-type': 'text/event-stream', 'x-vercel-ai-ui-message-stream': 'v1' } },
  );
const json = (body: object, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const RUN = [
  { type: 'start', messageId: 'reply-1' },
  { type: 'start-step' },
  {
    type: 'data-page-change',
    transient: true,
    data: { ops: [], summary: { inserted: [], updated: ['hero'], deleted: [], moved: [], replaced: [] }, blocks: [SHORTER] },
  },
  { type: 'finish-step' },
  { type: 'start-step' },
  { type: 'text-start', id: 't1' },
  { type: 'text-delta', id: 't1', delta: 'I made the heading shorter.' },
  { type: 'text-end', id: 't1' },
  { type: 'finish-step' },
  { type: 'finish' },
];

const stubAiFetch = ({
  enabled,
  canManage,
  onChat = () => sse(RUN),
}: {
  enabled: boolean;
  canManage: boolean;
  onChat?: (body: AiChatRequest) => Response;
}): void => {
  vi.stubGlobal(
    'fetch',
    createFakeChatServer().fetchWith(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = new URL(String(input), 'http://localhost').pathname;
      if (path === '/api/ai-builder/status') return json({ enabled, canManage });
      return onChat(JSON.parse(String(init?.body)) as AiChatRequest);
    }),
  );
};

const renderAskAi = ({
  selectedBlockId = null,
  selectBlock = vi.fn(),
  children,
}: {
  selectedBlockId?: string | null;
  selectBlock?: (id: string) => void;
  children?: ReactNode;
} = {}) =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <TooltipProvider>
        <PageAssistantProvider
          page={{ siteId: SITE_ID, pageId: PAGE_ID, contentType: 'page' }}
          getBlocks={() => [HERO]}
          applyBlocks={() => undefined}
          selectedBlockId={selectedBlockId}
          selectBlock={selectBlock}
          lockedRef={{ current: false }}>
          <AskAiButton blockId="hero" blockLabel="Heading" />
          {children}
        </PageAssistantProvider>
      </TooltipProvider>
    </QueryClientProvider>,
  );

const composerBox = (): HTMLElement | null => screen.queryByRole('textbox', { name: 'Message to the assistant' });

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, 'platform');
});

describe('Ask AI on a block', () => {
  it('limits the run to that block, shows the answer, and Undo puts the block back', async () => {
    const chatBodies: AiChatRequest[] = [];
    vi.stubGlobal(
      'fetch',
      createFakeChatServer().fetchWith(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input), 'http://localhost').pathname;
        if (path === '/api/ai-builder/status') return json({ enabled: true, canManage: false });
        chatBodies.push(JSON.parse(String(init?.body)) as AiChatRequest);
        return sse(RUN);
      }),
    );
    let tree: BlockConfig[] = [HERO];
    const applied: Array<{ ids: string; newStep: boolean }> = [];
    const selectBlock = vi.fn();

    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <TooltipProvider>
          <PageAssistantProvider
            page={{ siteId: SITE_ID, pageId: PAGE_ID, contentType: 'page' }}
            getBlocks={() => tree}
            applyBlocks={(blocks, { newStep }) => {
              tree = blocks;
              applied.push({ ids: JSON.stringify(blocks.map((block) => (block.content as { value?: string }).value)), newStep });
            }}
            selectedBlockId={null}
            selectBlock={selectBlock}
            lockedRef={{ current: false }}>
            <AskAiButton blockId="hero" blockLabel="Heading" />
          </PageAssistantProvider>
        </TooltipProvider>
      </QueryClientProvider>,
    );

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Ask AI about this block' }));
    expect(selectBlock).toHaveBeenCalledWith('hero');
    await user.type(screen.getByRole('textbox', { name: 'Message to the assistant' }), 'Make it shorter{Enter}');

    expect(await screen.findByText('I made the heading shorter.')).toBeTruthy();
    expect(chatBodies[0]?.focusBlockId).toBe('hero');
    expect(applied).toEqual([{ ids: '["Hi"]', newStep: true }]);

    await user.click(screen.getByRole('button', { name: /undo this change/i }));
    expect(applied.at(-1)).toEqual({ ids: '["Hello"]', newStep: true });
  });

  it('shows a visible AI label on the toolbar button, even before the assistant is checked', () => {
    stubAiFetch({ enabled: true, canManage: false });
    renderAskAi();
    const button = screen.getByRole('button', { name: 'Ask AI about this block' });
    expect(button.textContent).toBe('AI');
  });

  it('explains how to turn the assistant on, with a link to AI settings, when an admin can set it up', async () => {
    stubAiFetch({ enabled: false, canManage: true });
    renderAskAi();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ask AI about this block' }));
    const link = await screen.findByRole('link', { name: 'Settings → AI' });
    expect(link.getAttribute('href')).toBe('/admin/settings?tab=ai');
    expect(composerBox()).toBeNull();
  });

  it('tells a member to ask a site admin when the assistant is off', async () => {
    stubAiFetch({ enabled: false, canManage: false });
    renderAskAi();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ask AI about this block' }));
    expect(await screen.findByText('Ask a site admin to turn on the assistant.')).toBeTruthy();
  });

  it('a quick chip sends its text for this block', async () => {
    const chatBodies: AiChatRequest[] = [];
    stubAiFetch({
      enabled: true,
      canManage: false,
      onChat: (body) => {
        chatBodies.push(body);
        return sse(RUN);
      },
    });
    renderAskAi();
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Ask AI about this block' }));
    await user.click(await screen.findByRole('button', { name: 'Make it shorter' }));
    await waitFor(() => expect(chatBodies).toHaveLength(1));
    expect(chatBodies[0]?.focusBlockId).toBe('hero');
    expect(JSON.stringify(chatBodies[0]?.messages.at(-1))).toContain('Make it shorter');
  });

  it('Ctrl+J opens the box for the selected block', async () => {
    stubAiFetch({ enabled: true, canManage: false });
    renderAskAi({ selectedBlockId: 'hero' });
    fireEvent.keyDown(document.body, { key: 'j', ctrlKey: true });
    expect(await screen.findByRole('textbox', { name: 'Message to the assistant' })).toBeTruthy();
  });

  it('uses ⌘J on Mac', async () => {
    Object.defineProperty(navigator, 'platform', { value: 'MacIntel', configurable: true });
    stubAiFetch({ enabled: true, canManage: false });
    renderAskAi({ selectedBlockId: 'hero' });
    fireEvent.keyDown(document.body, { key: 'j', metaKey: true });
    expect(await screen.findByRole('textbox', { name: 'Message to the assistant' })).toBeTruthy();
  });

  it('does nothing when another block is selected', () => {
    stubAiFetch({ enabled: true, canManage: false });
    renderAskAi({ selectedBlockId: 'other' });
    fireEvent.keyDown(document.body, { key: 'j', ctrlKey: true });
    expect(composerBox()).toBeNull();
  });

  it('ignores Ctrl+J while typing in a field', () => {
    stubAiFetch({ enabled: true, canManage: false });
    renderAskAi({ selectedBlockId: 'hero', children: <input aria-label="Page title" /> });
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Page title' }), { key: 'j', ctrlKey: true });
    expect(composerBox()).toBeNull();
  });

  it('removes its shortcut listener when it unmounts', () => {
    stubAiFetch({ enabled: true, canManage: false });
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderAskAi({ selectedBlockId: 'hero' });
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    removeSpy.mockRestore();
  });
});

describe('Test connection in Settings → AI', () => {
  const renderTest = () => render(<AiConnectionTest siteId={SITE_ID} />);

  it('says the connection works when the model used the tool', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => json({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);
    renderTest();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Test connection' }));
    expect(await screen.findByText(AI_ASSISTANT_MESSAGES.testOk)).toBeTruthy();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/api/ai-builder/settings/test');
  });

  it("shows the server's plain answer when the model can't use tools", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ ok: false, code: 'no_tool_use', message: AI_ASSISTANT_MESSAGES.noToolUse })));
    renderTest();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Test connection' }));
    expect(await screen.findByText(AI_ASSISTANT_MESSAGES.noToolUse)).toBeTruthy();
  });

  it('shows a plain line, not raw server text, when the test itself fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>Bad Gateway</html>', { status: 502 })));
    renderTest();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Test connection' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain("couldn't run"));
    expect(document.body.textContent).not.toContain('Bad Gateway');
  });
});
