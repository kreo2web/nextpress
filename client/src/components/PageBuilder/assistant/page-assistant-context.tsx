import { createContext, useContext, useEffect, useMemo, type ReactElement, type ReactNode } from 'react';
import type { AiChatContentType } from '@shared/ai-builder';
import type { BlockConfig } from '@shared/schema-types';
import { useAiStatus } from '@/hooks/use-ai-settings';
import { takePendingDescription } from './assistant-storage';
import { usePageAssistant, type ApplyAssistantBlocks, type PageAssistant } from './use-page-assistant';

export type AssistantAvailability = 'loading' | 'ready' | 'needs-setup' | 'ask-admin' | 'unavailable';

export type PageAssistantContextValue = {
  assistant: PageAssistant;
  availability: AssistantAvailability;
  selectedBlockId: string | null;
  selectBlock: (id: string) => void;
};

const PageAssistantContext = createContext<PageAssistantContextValue | null>(null);

/** The assistant for the open page, or null where there is none (templates, or outside the editor). */
export const usePageAssistantContext = (): PageAssistantContextValue | null => useContext(PageAssistantContext);

const readAvailability = ({
  isLoading,
  isError,
  enabled,
  canManage,
}: {
  isLoading: boolean;
  isError: boolean;
  enabled?: boolean;
  canManage?: boolean;
}): AssistantAvailability => {
  if (isLoading) return 'loading';
  if (isError) return 'unavailable';
  if (enabled) return 'ready';
  return canManage ? 'needs-setup' : 'ask-admin';
};

function useMountEffect(effect: () => void | (() => void)): void {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(effect, []);
}

export type AssistantPageRef = { siteId: string; pageId: string; contentType: AiChatContentType };

type ActiveProviderProps = AssistantPageRef & {
  getBlocks: () => BlockConfig[];
  applyBlocks: ApplyAssistantBlocks;
  selectedBlockId: string | null;
  selectBlock: (id: string) => void;
  /** Kept current on every render so the editor's keyboard shortcuts can stand down during a run. */
  lockedRef: { current: boolean };
  children: ReactNode;
};

export type PageAssistantProviderProps = Omit<ActiveProviderProps, keyof AssistantPageRef> & {
  /** The saved page or post open in the editor; null for templates, which have no assistant. */
  page: AssistantPageRef | null;
};

/**
 * Runs the assistant for one page and hands it to the sidebar tab, the Ask AI button and the lock.
 * Without a page (templates) it adds nothing and the editor looks as before.
 */
export function PageAssistantProvider({ page, children, lockedRef, ...rest }: PageAssistantProviderProps): ReactElement {
  if (!page) {
    lockedRef.current = false;
    return <>{children}</>;
  }
  return (
    <ActivePageAssistantProvider key={page.pageId} {...page} {...rest} lockedRef={lockedRef}>
      {children}
    </ActivePageAssistantProvider>
  );
}

/** A description left by "Describe your page" starts the first run once the editor has loaded. */
function ActivePageAssistantProvider({
  siteId,
  pageId,
  contentType,
  getBlocks,
  applyBlocks,
  selectedBlockId,
  selectBlock,
  lockedRef,
  children,
}: ActiveProviderProps): ReactElement {
  const statusQuery = useAiStatus({ siteId });
  const assistant = usePageAssistant({ siteId, pageId, contentType, getBlocks, applyBlocks });
  lockedRef.current = assistant.isLocked;

  useMountEffect(() => {
    const description = takePendingDescription(pageId);
    if (description) assistant.send({ text: description });
  });

  const availability = readAvailability({
    isLoading: statusQuery.isLoading,
    isError: statusQuery.isError,
    enabled: statusQuery.data?.enabled,
    canManage: statusQuery.data?.canManage,
  });

  const value = useMemo(
    () => ({ assistant, availability, selectedBlockId, selectBlock }),
    [assistant, availability, selectedBlockId, selectBlock],
  );

  return <PageAssistantContext.Provider value={value}>{children}</PageAssistantContext.Provider>;
}
