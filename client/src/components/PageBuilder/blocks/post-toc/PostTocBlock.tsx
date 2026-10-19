import * as React from 'react';
import { ListOrdered } from 'lucide-react';
import type { BlockDefinition, BlockComponentProps } from '../types.ts';
import type { BlockConfig } from '@shared/schema-types';
import { useBlockAccessors, type BlockStateAccessor } from '../blockStateRegistry';
import { SettingsLabel, SettingsSection } from '../../shared';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettingsState } from '../useSettingsState';
import { useBlockState } from '../useBlockState';
import { BlockShell } from '../shared/block-shell';
import { defaultParseContent, defaultSerializeContent } from '../createBlockDefinition';
import { usePageHeadings, type HeadingEntry } from './use-page-headings';
import { POST_TOC_DEFAULT_CONTENT } from '@shared/block-catalog/post-blocks';
import { catalogMeta } from '../catalog-meta';

// ============================================================================
// TYPES
// ============================================================================

export type PostTocContent = {
  title?: string;
  maxDepth?: number;
  ordered?: boolean;
  sticky?: boolean;
  className?: string;
};

type CoreHeadingContent = {
  value?: string;
  level?: number;
  anchor?: string;
};

type PostTitleHeadingContent = {
  text?: string;
  tag?: string;
};

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONTENT: PostTocContent = POST_TOC_DEFAULT_CONTENT;

const DEPTH_OPTIONS = [1, 2, 3, 4, 5, 6] as const;
const HEADING_BLOCK = 'core/heading';
const TITLE_BLOCK = 'post/title';
const EMPTY_HEADINGS_COPY = 'Headings on this page show up here.';

// ============================================================================
// UTILITIES
// ============================================================================

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, '').trim();
}

function slugFromText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function levelFromTitleTag(tag: string | undefined): number {
  if (tag === 'h2') return 2;
  if (tag === 'h3') return 3;
  return 1;
}

function headingFromAccessor(accessor: BlockStateAccessor): HeadingEntry | null {
  const name = accessor.getFullState().name;
  const content = accessor.getContent();
  if (!content || typeof content !== 'object') return null;

  if (name === HEADING_BLOCK) {
    const heading = content as CoreHeadingContent;
    const text = stripTags(heading.value ?? '');
    if (!text) return null;
    const level = heading.level || 2;
    return { id: heading.anchor || slugFromText(text), text, level };
  }

  if (name === TITLE_BLOCK) {
    const title = content as PostTitleHeadingContent;
    const text = stripTags(title.text ?? '');
    if (!text) return null;
    return { id: slugFromText(text), text, level: levelFromTitleTag(title.tag) };
  }

  return null;
}

/** Live heading blocks from the editor registry, filtered by maxDepth. */
function collectEditorHeadings(
  accessors: BlockStateAccessor[],
  maxDepth: number,
): HeadingEntry[] {
  return accessors
    .map(headingFromAccessor)
    .filter((entry): entry is HeadingEntry => entry !== null && entry.level <= maxDepth);
}

/**
 * Compute a hierarchical numbering label for a heading entry
 * (e.g. "1", "1.1", "2.1.1") based on its position in the list.
 */
function computeNumbering(entries: HeadingEntry[]): string[] {
  const counters: number[] = [];
  return entries.map((entry) => {
    const depth = entry.level;
    while (counters.length < depth) counters.push(0);
    counters.length = depth;
    counters[depth - 1] = (counters[depth - 1] || 0) + 1;
    return counters.join('.');
  });
}

/**
 * Indent padding in rem per heading depth level.
 * level 1 = 0, level 2 = 1rem, level 3 = 2rem, etc.
 */
function indentForLevel(level: number): string {
  return `${(level - 1) * 1}rem`;
}

function depthLabel(depth: number): string {
  return depth > 1 ? `H1 to H${depth}` : 'H1 only';
}

// ============================================================================
// RENDERER
// ============================================================================

type PostTocRendererProps = {
  content: PostTocContent;
  styles?: React.CSSProperties;
  isPreview?: boolean;
  entries: HeadingEntry[];
};

/**
 * Pure presentational renderer for the Table of Contents block.
 * Headings are passed in — this component never scans or calls useEffect.
 */
function PostTocRenderer({ content, styles, isPreview, entries }: PostTocRendererProps) {
  const ordered = content?.ordered ?? false;
  const title = content?.title ?? '';
  const numbering = computeNumbering(entries);
  const ListTag = ordered ? 'ol' : 'ul';
  const sticky = content?.sticky === true;

  return (
    <BlockShell
      as="nav"
      blockClass="wp-block-post-toc"
      className={content?.className}
      style={{
        border: '1px solid var(--npb-border-default)',
        borderRadius: 'var(--npb-radius-input)',
        padding: '1.25rem 1.5rem',
        backgroundColor: 'var(--npb-surface-raised)',
        ...(sticky
          ? { position: 'sticky', top: '1rem', zIndex: 5, alignSelf: 'flex-start' }
          : {}),
        ...styles,
      }}
      aria-label="Table of contents">
      {title && (
        <p className="font-semibold text-sm mb-3 text-npb-text-primary">
          {title}
        </p>
      )}

      {entries.length === 0 ? (
        <p className="text-sm text-npb-text-muted">
          {EMPTY_HEADINGS_COPY}
        </p>
      ) : (
        <ListTag style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {entries.map((entry, idx) => (
            <li
              key={`${entry.id}-${idx}`}
              style={{
                paddingLeft: indentForLevel(entry.level),
                marginBottom: '0.35rem',
              }}>
              {isPreview ? (
                <a
                  href={`#${entry.id}`}
                  className="text-npb-accent no-underline text-sm hover:underline">
                  {ordered ? `${numbering[idx]} ` : ''}
                  {entry.text}
                </a>
              ) : (
                <span className="text-sm text-npb-text-secondary">
                  {ordered ? `${numbering[idx]} ` : '• '}
                  {entry.text}
                </span>
              )}
            </li>
          ))}
        </ListTag>
      )}
    </BlockShell>
  );
}

function PostTocEditor({
  content,
  styles,
}: {
  content: PostTocContent;
  styles?: React.CSSProperties;
}) {
  const accessors = useBlockAccessors();
  const maxDepth = content?.maxDepth ?? 3;
  const entries = collectEditorHeadings(accessors, maxDepth);
  return (
    <PostTocRenderer content={content} styles={styles} entries={entries} />
  );
}

function PostTocPreview({
  content,
  styles,
}: {
  content: PostTocContent;
  styles?: React.CSSProperties;
}) {
  const maxDepth = content?.maxDepth ?? 3;
  const entries = usePageHeadings(maxDepth);
  return (
    <PostTocRenderer content={content} styles={styles} isPreview entries={entries} />
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PostTocComponent({
  value,
  onChange,
  isPreview,
}: BlockComponentProps) {
  const { content, styles } = useBlockState<PostTocContent>({
    value,
    getDefaultContent: () => DEFAULT_CONTENT,
    onChange,
    parseContent: defaultParseContent,
    serializeContent: defaultSerializeContent,
  });
  const maxDepth = content?.maxDepth ?? 3;

  if (isPreview) {
    return <PostTocPreview key={maxDepth} content={content} styles={styles} />;
  }

  return <PostTocEditor content={content} styles={styles} />;
}

// ============================================================================
// SETTINGS COMPONENT
// ============================================================================

type PostTocSettingsProps = {
  block: BlockConfig;
  onUpdate?: (updates: Partial<BlockConfig>) => void;
};

/**
 * Sidebar settings for the Table of Contents: title, heading depth, numbered list.
 */
function PostTocSettings({ block, onUpdate }: PostTocSettingsProps) {
  const { content, updateContent } = useSettingsState<PostTocContent>({
    block,
    onUpdate,
    defaultContent: DEFAULT_CONTENT,
    parseContent: defaultParseContent,
    serializeContent: defaultSerializeContent,
  });

  return (
    <SettingsSection>
      <div>
        <SettingsLabel htmlFor="toc-title">Title</SettingsLabel>
        <Input
          id="toc-title"
          aria-label="Title"
          value={content?.title ?? ''}
          onChange={(e) => updateContent({ title: e.target.value })}
          placeholder='e.g. "Table of Contents"'
          className="mt-1 h-9 text-sm"
        />
      </div>
      <div>
        <SettingsLabel htmlFor="toc-depth">Include headings through</SettingsLabel>
        <Select
          value={String(content?.maxDepth ?? 3)}
          onValueChange={(val) => updateContent({ maxDepth: Number(val) })}>
          <SelectTrigger id="toc-depth" className="mt-1 h-9 text-sm">
            <SelectValue placeholder="Select depth" />
          </SelectTrigger>
          <SelectContent>
            {DEPTH_OPTIONS.map((depth) => (
              <SelectItem key={depth} value={String(depth)}>
                {depthLabel(depth)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between">
        <SettingsLabel htmlFor="toc-ordered">Numbered List</SettingsLabel>
        <Switch
          id="toc-ordered"
          checked={content?.ordered ?? false}
          onCheckedChange={(checked) => updateContent({ ordered: checked })}
        />
      </div>
      <div className="flex items-center justify-between">
        <SettingsLabel htmlFor="toc-sticky">Stay on screen while scrolling</SettingsLabel>
        <Switch
          id="toc-sticky"
          checked={content?.sticky === true}
          onCheckedChange={(checked) => updateContent({ sticky: checked })}
        />
      </div>
      {content?.sticky === true ? (
        <p className="npb-settings-hint-muted -mt-2 text-xs">
          The list stays in view as the page scrolls. Put it in a side column so it has room.
        </p>
      ) : null}
    </SettingsSection>
  );
}

// ============================================================================
// BLOCK DEFINITION
// ============================================================================

/**
 * Post Table of Contents block definition for the PageBuilder.
 * Editor reads heading blocks from the live registry; preview scans the page
 * after paint via usePageHeadings (hook file, not this component).
 */
const PostTocBlock: BlockDefinition = {
  ...catalogMeta('post/toc'),
  icon: ListOrdered,
  defaultContent: DEFAULT_CONTENT,
  component: PostTocComponent,
  settings: PostTocSettings,
  hasSettings: true,
  parseContent: defaultParseContent,
  serializeContent: defaultSerializeContent,
};

export default PostTocBlock;
