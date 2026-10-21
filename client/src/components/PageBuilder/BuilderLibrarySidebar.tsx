import { useState, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChevronsDownUp, ChevronsUpDown, MessageSquare, Plus, Sidebar } from 'lucide-react';
import { ResponsiveHealthBanner } from './ResponsiveHealthBanner';
import { BuilderLibraryPanel } from './BuilderLibraryPanel';
import type { BlockConfig } from '@shared/schema-types';
import { useBuilderLibraryState } from './use-builder-library-state';
import { AssistantPanel, usePageAssistantContext } from './assistant';

type RailTab = 'blocks' | 'assistant';

/** Left rail: block library and templates at wide builder widths. */
export type BuilderLibrarySidebarProps = {
  onToggleSidebar: () => void;
  onInsertTemplate?: (blocks: BlockConfig[]) => void;
  blocks?: BlockConfig[];
  onApplyResponsiveDefaults?: () => boolean | void;
  responsiveHealthBannerDismissed?: boolean;
};

const rootClass =
  'npb-builder-library-sidebar npb-editor-sidebar flex h-full min-h-0 w-[var(--npb-builder-library-width)] shrink-0 flex-col overflow-hidden border-r border-npb-border-strong bg-npb-surface-base text-npb-text-secondary shadow-[var(--npb-shadow-surface)]';
const headerRowClass =
  'flex w-full items-center justify-between gap-2 bg-npb-surface-header p-4';
const titleClass =
  'text-lg font-semibold tracking-tight text-npb-text-primary';
const tabsListClass =
  'grid h-auto min-h-10 w-full grid-cols-2 rounded-[var(--npb-radius-surface)] bg-npb-surface-inset p-1';
const tabTriggerClass =
  'flex min-h-9 items-center gap-2 rounded-[var(--npb-radius-input)] px-4 py-2.5 text-sm font-medium text-npb-text-muted hover:bg-npb-interactive-bg-hover hover:text-npb-text-primary data-[state=active]:bg-npb-interactive-bg-active data-[state=active]:text-npb-interactive-text-active transition-colors';
const headerIconBtnClass =
  'h-9 w-9 shrink-0 rounded-[var(--npb-radius-input)] p-0 text-npb-text-muted hover:bg-npb-interactive-bg-hover hover:text-npb-text-primary focus-visible:ring-npb-focus focus-visible:ring-offset-0';

/**
 * Fixed left library rail for wide viewports. Blocks are added via drag-and-drop.
 */
export function BuilderLibrarySidebar({
  onToggleSidebar,
  onInsertTemplate,
  blocks = [],
  onApplyResponsiveDefaults,
  responsiveHealthBannerDismissed = false,
}: BuilderLibrarySidebarProps): ReactElement {
  const {
    categories,
    openCategories,
    allLibraryGroupsExpanded,
    onToggleLibraryFold,
    onCategoryOpenChange,
  } = useBuilderLibraryState();
  const hasAssistant = usePageAssistantContext() !== null;
  const [railTab, setRailTab] = useState<RailTab>('blocks');

  const library = (
    <BuilderLibraryPanel
      categories={categories}
      openCategories={openCategories}
      onCategoryOpenChange={onCategoryOpenChange}
      onInsertTemplate={onInsertTemplate}
    />
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className={rootClass}>
        <div className={headerRowClass}>
          <h2 className={titleClass}>NextPress Editor</h2>
          <div className="flex shrink-0 items-center gap-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className={headerIconBtnClass}
                  aria-label={
                    allLibraryGroupsExpanded
                      ? 'Collapse all block groups'
                      : 'Expand all block groups'
                  }
                  onClick={onToggleLibraryFold}
                  disabled={categories.length === 0}>
                  {allLibraryGroupsExpanded ? (
                    <ChevronsDownUp className="h-5 w-5" aria-hidden />
                  ) : (
                    <ChevronsUpDown className="h-5 w-5" aria-hidden />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                {allLibraryGroupsExpanded
                  ? 'Collapse all block groups'
                  : 'Expand all block groups'}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onToggleSidebar}
                  className={headerIconBtnClass}
                  aria-label="Collapse block library">
                  <Sidebar className="h-5 w-5" aria-hidden />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Collapse block library</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <ResponsiveHealthBanner
          blocks={blocks}
          onApplyDefaults={onApplyResponsiveDefaults}
          dismissed={responsiveHealthBannerDismissed}
        />
        {hasAssistant ? (
          <Tabs
            value={railTab}
            onValueChange={(value) => setRailTab(value as RailTab)}
            className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
            <TabsList className={tabsListClass}>
              <TabsTrigger value="blocks" className={tabTriggerClass}>
                <Plus className="h-4 w-4" aria-hidden /> Blocks
              </TabsTrigger>
              <TabsTrigger value="assistant" className={tabTriggerClass}>
                <MessageSquare className="h-4 w-4" aria-hidden /> Assistant
              </TabsTrigger>
            </TabsList>
            <TabsContent value="blocks" className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
              {library}
            </TabsContent>
            <TabsContent value="assistant" className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden">
              <AssistantPanel />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="min-h-0 flex-1 p-3 sm:p-4">{library}</div>
        )}
      </div>
    </TooltipProvider>
  );
}
