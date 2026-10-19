import * as React from 'react';
import type { BlockConfig } from '@shared/schema-types';
import { SettingsLabel, SettingsSection } from '../../shared';
import { Input } from '@/components/ui/input';
import { Type } from 'lucide-react';
import { useSettingsState } from '../useSettingsState';
import { createBlockDefinition } from '../createBlockDefinition';
import { BlockShell } from '../shared/block-shell';
import { InlineTextEditor } from '../shared/inline-text-editor';
import { SettingsChipGroup } from '../../settings-chip-group';
import { usePostDocument } from '../../PageContext';
import { headingAnchorId } from '@shared/page-headings';
import { POST_TITLE_DEFAULT_CONTENT } from '@shared/block-catalog/post-blocks';
import { catalogMeta } from '../catalog-meta';

// ============================================================================
// TYPES
// ============================================================================

export type PostTitleContent = {
  text?: string;
  tag?: 'h1' | 'h2' | 'h3';
  className?: string;
};

const DEFAULT_CONTENT: PostTitleContent = POST_TITLE_DEFAULT_CONTENT;

const HEADING_TAG_OPTIONS = [
  { value: 'h1' as const, label: 'H1' },
  { value: 'h2' as const, label: 'H2' },
  { value: 'h3' as const, label: 'H3' },
] as const;

function isPostTitleTag(value: string): value is NonNullable<PostTitleContent['tag']> {
  return value === 'h1' || value === 'h2' || value === 'h3';
}

// ============================================================================
// RENDERER
// ============================================================================

interface PostTitleRendererProps {
  content: PostTitleContent;
  styles?: React.CSSProperties;
  onTextChange?: (text: string) => void;
}

/**
 * Pure presentational renderer for the post title.
 * Uses the post document title when the block still has the default placeholder.
 */
function PostTitleRenderer({ content, styles, onTextChange }: PostTitleRendererProps) {
  const postDocument = usePostDocument();
  const raw = content?.text || '';
  const text =
    raw && raw !== DEFAULT_CONTENT.text
      ? raw
      : postDocument?.title || raw || 'Post Title';
  const tag = content?.tag || 'h1';
  const headingId = headingAnchorId({ text }) || undefined;
  const mergedStyles: React.CSSProperties = {
    color: 'var(--npb-text-primary)',
    ...styles,
  };

  return (
    <BlockShell as={tag} blockClass="wp-block-post-title" className={content?.className} style={mergedStyles} id={headingId}>
      {onTextChange ? (
        <InlineTextEditor
          ariaLabel="Post title"
          value={text}
          onChange={(next) => {
            onTextChange(next);
            postDocument?.updateDocument({ title: next });
          }}
          style={mergedStyles}
          growToWrap
        />
      ) : (
        text
      )}
    </BlockShell>
  );
}

// ============================================================================
// SETTINGS COMPONENT
// ============================================================================

interface PostTitleSettingsProps {
  block: BlockConfig;
  onUpdate?: (updates: Partial<BlockConfig>) => void;
}

/**
 * Sidebar settings for the post title: the name, then heading level.
 */
function PostTitleSettings({ block, onUpdate }: PostTitleSettingsProps) {
  const { content, updateContent } = useSettingsState<PostTitleContent>({
    block,
    onUpdate,
    defaultContent: DEFAULT_CONTENT,
  });
  const postDocument = usePostDocument();

  const currentTag = content?.tag || 'h1';
  const titleValue =
    content?.text && content.text !== DEFAULT_CONTENT.text
      ? content.text
      : postDocument?.title || content?.text || '';

  const setTitle = (text: string) => {
    updateContent({ text });
    postDocument?.updateDocument({ title: text });
  };

  return (
    <SettingsSection>
      <div>
        <SettingsLabel htmlFor="post-title-text">Post title</SettingsLabel>
        <Input
          id="post-title-text"
          value={titleValue}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Enter the post title"
          className="mt-1 h-9 text-sm"
        />
      </div>
      <SettingsChipGroup
        label="Heading Level"
        options={[...HEADING_TAG_OPTIONS]}
        value={currentTag}
        onChange={(value) => {
          if (!isPostTitleTag(value)) return;
          updateContent({ tag: value });
        }}
      />
    </SettingsSection>
  );
}

// ============================================================================
// BLOCK DEFINITION
// ============================================================================

/**
 * Post Title block definition for the PageBuilder.
 * Renders the post title as a configurable heading element (h1/h2/h3).
 * In editor mode the title is inline-editable; in preview mode it renders
 * as a static heading.
 */
const PostTitleBlock = createBlockDefinition<PostTitleContent>({
  ...catalogMeta('post/title'),
  icon: Type,
  defaultContent: DEFAULT_CONTENT,
  settings: PostTitleSettings,
  hasSettings: true,
  render: ({ content, styles, setContent }) => (
    <PostTitleRenderer
      content={content}
      styles={styles}
      onTextChange={(text) => {
        setContent((prev) => ({ ...prev, text }));
      }}
    />
  ),
});

export default PostTitleBlock;
