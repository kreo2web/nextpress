// blocks/post-excerpt/PostExcerptBlock.tsx
import * as React from 'react';
import type { BlockConfig } from '@shared/schema-types';
import { SettingsLabel, SettingsSection } from '../../shared';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { FileText } from 'lucide-react';
import { useSettingsState } from '../useSettingsState';
import { createBlockDefinition } from '../createBlockDefinition';
import { BlockShell } from '../shared/block-shell';
import { usePostDocument } from '../../PageContext';
import {
  DEFAULT_READ_MORE_TEXT,
  truncateExcerpt,
} from '@shared/excerpt-display';
import { POST_EXCERPT_DEFAULT_CONTENT } from '@shared/block-catalog/post-blocks';
import { catalogMeta } from '../catalog-meta';

// ============================================================================
// TYPES
// ============================================================================

export type PostExcerptContent = {
  text?: string;
  maxLength?: number;
  showReadMore?: boolean;
  readMoreText?: string;
  className?: string;
};

// ============================================================================
// CONSTANTS
// ============================================================================

const DEFAULT_CONTENT: PostExcerptContent = POST_EXCERPT_DEFAULT_CONTENT;

const MAX_LENGTH_MIN = 50;
const MAX_LENGTH_MAX = 500;
const MAX_LENGTH_STEP = 10;

// ============================================================================
// RENDERER
// ============================================================================

interface PostExcerptRendererProps {
  content: PostExcerptContent;
  styles?: React.CSSProperties;
  onTextChange?: (text: string) => void;
}

/**
 * Pure presentational renderer for the post excerpt.
 * Editor canvas is inline-editable; preview shows the truncated summary.
 */
function PostExcerptRenderer({ content, styles, onTextChange }: PostExcerptRendererProps) {
  const postDocument = usePostDocument();
  const raw = content?.text || '';
  const text =
    raw && raw !== DEFAULT_CONTENT.text
      ? raw
      : postDocument?.excerpt || raw;
  const maxLength = content?.maxLength ?? DEFAULT_CONTENT.maxLength!;
  const showReadMore = content?.showReadMore ?? true;
  const readMoreText = content?.readMoreText || DEFAULT_READ_MORE_TEXT;

  const { truncated } = truncateExcerpt({ text, maxLength });

  return (
    <BlockShell blockClass="wp-block-post-excerpt" className={content?.className} style={styles}>
      {onTextChange ? (
        <textarea
          aria-label="Post excerpt"
          value={text}
          rows={3}
          onChange={(e) => {
            const next = e.target.value;
            onTextChange(next);
            postDocument?.updateDocument({ excerpt: next });
          }}
          placeholder="Write your post excerpt..."
          className="wp-block-post-excerpt__excerpt w-full resize-y bg-transparent p-0 outline-none"
          style={{ font: 'inherit', color: 'inherit', lineHeight: 'inherit' }}
        />
      ) : (
        <p className="wp-block-post-excerpt__excerpt">
          {truncated || 'Write your post excerpt...'}
        </p>
      )}
      {showReadMore && (
        <p className="wp-block-post-excerpt__more-link">
          <button
            type="button"
            onClick={(e) => e.preventDefault()}
            className="text-npb-accent underline"
          >
            {readMoreText}
          </button>
        </p>
      )}
    </BlockShell>
  );
}

// ============================================================================
// SETTINGS COMPONENT
// ============================================================================

interface PostExcerptSettingsProps {
  block: BlockConfig;
  onUpdate?: (updates: Partial<BlockConfig>) => void;
}

/**
 * Sidebar settings panel for the post excerpt block.
 * Controls max character length, "Read More" toggle/text, and CSS classes.
 */
function PostExcerptSettings({ block, onUpdate }: PostExcerptSettingsProps) {
  const { content, updateContent } = useSettingsState<PostExcerptContent>({
    block,
    onUpdate,
    defaultContent: DEFAULT_CONTENT,
  });
  const postDocument = usePostDocument();

  const currentMaxLength =
    content?.maxLength ?? DEFAULT_CONTENT.maxLength!;
  const currentShowReadMore = content?.showReadMore ?? true;
  const currentReadMoreText = content?.readMoreText || DEFAULT_READ_MORE_TEXT;
  const excerptText =
    content?.text && content.text !== DEFAULT_CONTENT.text
      ? content.text
      : postDocument?.excerpt || content?.text || '';

  const setMaxLength = (nextMaxLength: number) => {
    updateContent({ maxLength: nextMaxLength });
  };

  return (
    <SettingsSection>
      <div>
        <SettingsLabel htmlFor="excerpt-text">Excerpt Text</SettingsLabel>
        <Textarea
          id="excerpt-text"
          value={excerptText}
          onChange={(e) => {
            const text = e.target.value;
            updateContent({ text });
            postDocument?.updateDocument({ excerpt: text });
          }}
          placeholder="Write the post excerpt..."
          rows={4}
          className="mt-1 text-sm resize-y"
          aria-describedby="excerpt-text-count"
        />
        <p
          id="excerpt-text-count"
          className="mt-1 text-xs tabular-nums text-npb-text-muted">
          {excerptText.length} / {currentMaxLength} characters
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <SettingsLabel>Max Length</SettingsLabel>
          <span className="text-xs text-npb-text-muted">
            {currentMaxLength} characters
          </span>
        </div>
        <Slider
          value={[currentMaxLength]}
          min={MAX_LENGTH_MIN}
          max={MAX_LENGTH_MAX}
          step={MAX_LENGTH_STEP}
          onValueChange={([val]) => {
            if (typeof val === 'number') setMaxLength(val);
          }}
        />
      </div>

      <div className="flex items-center justify-between">
        <SettingsLabel htmlFor="show-read-more">Show "Read More"</SettingsLabel>
        <Switch
          id="show-read-more"
          checked={currentShowReadMore}
          onCheckedChange={(checked) =>
            updateContent({ showReadMore: checked })
          }
        />
      </div>

      {currentShowReadMore && (
        <div>
          <SettingsLabel htmlFor="read-more-text">Read More Text</SettingsLabel>
          <Input
            id="read-more-text"
            value={currentReadMoreText}
            onChange={(e) =>
              updateContent({ readMoreText: e.target.value })
            }
            placeholder="Read More"
            className="mt-1 h-9 text-sm"
          />
        </div>
      )}
    </SettingsSection>
  );
}

// BLOCK DEFINITION

/**
 * Post Excerpt block definition for the PageBuilder.
 * Displays a configurable post excerpt with truncation and optional "Read More" link.
 * Content is edited on the canvas or in the sidebar.
 */
const PostExcerptBlock = createBlockDefinition<PostExcerptContent>({
  ...catalogMeta('post/excerpt'),
  icon: FileText,
  defaultContent: DEFAULT_CONTENT,
  settings: PostExcerptSettings,
  hasSettings: true,
  render: ({ content, styles, setContent, isPreview }) => (
    <PostExcerptRenderer
      content={content}
      styles={styles}
      onTextChange={
        isPreview
          ? undefined
          : (text) => {
              setContent((prev) => ({ ...prev, text }));
            }
      }
    />
  ),
});

export default PostExcerptBlock;
