import React, { useState } from 'react';
import type { BlockConfig } from '@shared/schema-types';
import { SettingsLabel } from '../../shared';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { Frame, Image as ImageIcon } from 'lucide-react';
import { useSettingsState } from '../useSettingsState';
import { createBlockDefinition } from '../createBlockDefinition';
import { BlockShell } from '../shared/block-shell';
import { MediaUrlField } from '../shared/media-url-field';
import { usePostDocument } from '../../PageContext';
import { SettingsChipGroup } from '../../settings-chip-group';
import { IMAGE_ASPECT_PRESETS, isImageAspectPreset } from '@shared/image-frame';

// ============================================================================
// TYPES
// ============================================================================

export type PostFeaturedImageContent = {
  url?: string;
  alt?: string;
  caption?: string;
  objectFit?: 'cover' | 'contain' | 'fill';
  aspectRatio?: string;
  className?: string;
};

const DEFAULT_CONTENT: PostFeaturedImageContent = {
  url: '',
  alt: 'Featured image',
  caption: '',
  objectFit: 'cover',
  aspectRatio: '16/9',
  className: '',
};

type FeaturedImageFit = NonNullable<PostFeaturedImageContent['objectFit']>;

const FIT_OPTIONS: { value: FeaturedImageFit; label: string; accessibleName: string }[] = [
  { value: 'cover', label: 'Crop to fill', accessibleName: 'Crop to fill' },
  { value: 'contain', label: 'Show the whole image', accessibleName: 'Show the whole image' },
  { value: 'fill', label: 'Stretch', accessibleName: 'Stretch' },
];

function isFeaturedImageFit(value: string): value is FeaturedImageFit {
  return value === 'cover' || value === 'contain' || value === 'fill';
}

/** Frame opens itself only when fit or ratio is no longer the factory default. */
function hasFrameValues(content: PostFeaturedImageContent | undefined): boolean {
  const fit = content?.objectFit;
  const ratio = content?.aspectRatio;
  if (fit && fit !== DEFAULT_CONTENT.objectFit) return true;
  if (typeof ratio === 'string' && ratio.trim() !== '' && ratio !== DEFAULT_CONTENT.aspectRatio) {
    return true;
  }
  return false;
}

// ============================================================================
// URL INPUT ROW — reused in placeholder and hover overlay
// ============================================================================

/** Inline URL input + "Set" button used inside the renderer */
function UrlInputRow({
  value,
  onChange,
  onApply,
  placeholder,
  dark,
}: {
  value: string;
  onChange: (v: string) => void;
  onApply: () => void;
  placeholder: string;
  dark?: boolean;
}) {
  return (
    <div className="flex gap-1.5 px-4 w-full max-w-md">
      <Input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onApply()}
        placeholder={placeholder}
        className={cn(
          'h-9 flex-1',
          dark &&
            'border-white/30 bg-white/15 text-white placeholder:text-white/50',
        )}
      />
      <Button type="button" size="sm" className="h-9" onClick={onApply}>
        Set
      </Button>
    </div>
  );
}

// ============================================================================
// RENDERER
// ============================================================================

interface RendererProps {
  content: PostFeaturedImageContent;
  styles?: React.CSSProperties;
  isEditor?: boolean;
  onChangeUrl?: (url: string) => void;
}

/**
 * Renders the featured image or a dashed placeholder when no URL is set.
 * In editor mode an overlay with URL input appears on hover (or inline for empty state).
 */
function PostFeaturedImageRenderer({
  content,
  styles,
  isEditor = false,
  onChangeUrl,
}: RendererProps) {
  const postDocument = usePostDocument();
  const [isHovered, setIsHovered] = useState(false);
  const [editUrl, setEditUrl] = useState('');

  const {
    url: contentUrl = '',
    alt = 'Featured image',
    caption = '',
    objectFit = 'cover',
    aspectRatio = '16/9',
    className = '',
  } = content ?? {};
  const url = contentUrl || postDocument?.featuredImage || '';

  const handleApply = () => {
    if (onChangeUrl && editUrl.trim()) {
      const nextUrl = editUrl.trim();
      onChangeUrl(nextUrl);
      postDocument?.updateDocument({ featuredImage: nextUrl });
      setEditUrl('');
    }
  };

  // Empty state — placeholder with dashed border
  if (!url) {
    return (
      <BlockShell as="figure" blockClass="wp-block-post-featured-image" className={className} style={styles}>
        <div
          className={
            `flex flex-col items-center justify-center gap-2 border-2 border-dashed border-npb-border-default rounded-lg bg-npb-surface-raised text-npb-text-muted ` +
            (isEditor ? 'cursor-pointer' : 'cursor-default')
          }
          style={{ aspectRatio, width: '100%' }}>
          <ImageIcon className="w-8 h-8 opacity-50" />
          <span className="text-sm font-medium">Set Featured Image</span>
          {isEditor && (
            <div className="mt-1">
              <UrlInputRow
                value={editUrl}
                onChange={setEditUrl}
                onApply={handleApply}
                placeholder="Paste image URL..."
              />
            </div>
          )}
        </div>
      </BlockShell>
    );
  }

  // Image present — render with optional editor hover overlay
  return (
    <BlockShell as="figure" blockClass="wp-block-post-featured-image" className={className} style={styles}>
      <div
        className="relative w-full overflow-hidden"
        style={{ aspectRatio }}
        onMouseEnter={() => isEditor && setIsHovered(true)}
        onMouseLeave={() => isEditor && setIsHovered(false)}>
        <img
          src={url}
          alt={alt}
          className="w-full h-full block rounded"
          style={{ objectFit }}
        />

        {isEditor && isHovered && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 rounded">
            <span className="text-sm font-semibold text-white">Change Image</span>
            <UrlInputRow
              value={editUrl}
              onChange={setEditUrl}
              onApply={handleApply}
              placeholder="Paste new image URL..."
              dark
            />
          </div>
        )}
      </div>

      {caption && (
        <figcaption className="wp-element-caption text-center mt-2 text-npb-text-muted text-sm">
          {caption}
        </figcaption>
      )}
    </BlockShell>
  );
}

// ============================================================================
// SETTINGS COMPONENT
// ============================================================================

function PostFeaturedImageSettings({
  block,
  onUpdate,
}: {
  block: BlockConfig;
  onUpdate?: (updates: Partial<BlockConfig>) => void;
}) {
  const { content, updateContent } = useSettingsState<PostFeaturedImageContent>({
    block,
    onUpdate,
    defaultContent: DEFAULT_CONTENT,
  });
  const postDocument = usePostDocument();
  const imageUrl = content?.url || postDocument?.featuredImage || '';

  const setUrl = (url: string) => {
    updateContent({ url });
    postDocument?.updateDocument({ featuredImage: url });
  };

  return (
    <div className="space-y-4">
      <CollapsibleCard title="Image" icon={ImageIcon} defaultOpen={true}>
        <div className="space-y-4">
          <MediaUrlField
            id="fi-url"
            label="Featured image"
            value={imageUrl}
            kind="image"
            placeholder="Paste an image URL or choose from the library"
            libraryButtonLabel="Choose from library"
            onChange={({ url }) => setUrl(url)}
            onLibrarySelect={({ item }) => setUrl(item.url)}
          />
          <div>
            <SettingsLabel htmlFor="fi-alt">Alt Text</SettingsLabel>
            <Input
              id="fi-alt"
              value={content?.alt || ''}
              onChange={(e) => updateContent({ alt: e.target.value })}
              placeholder="Describe the image"
              className="h-9"
            />
          </div>
          <div>
            <SettingsLabel htmlFor="fi-caption">Caption</SettingsLabel>
            <Input
              id="fi-caption"
              value={content?.caption || ''}
              onChange={(e) => updateContent({ caption: e.target.value })}
              placeholder="Optional caption"
              className="h-9"
            />
          </div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Frame" icon={Frame} defaultOpen={hasFrameValues(content)}>
        <div className="space-y-4">
          <SettingsChipGroup
            label="Fit"
            ariaLabel="Fit"
            labelMaxChars={22}
            options={FIT_OPTIONS}
            value={content?.objectFit || 'cover'}
            onChange={(value) => {
              if (isFeaturedImageFit(value)) {
                updateContent({ objectFit: value });
              }
            }}
          />
          <SettingsChipGroup
            label="Aspect"
            ariaLabel="Aspect"
            options={[...IMAGE_ASPECT_PRESETS]}
            value={content?.aspectRatio || '16/9'}
            onChange={(value) => {
              if (isImageAspectPreset(value)) {
                updateContent({ aspectRatio: value });
              }
            }}
          />
        </div>
      </CollapsibleCard>
    </div>
  );
}

// ============================================================================
// BLOCK DEFINITION
// ============================================================================

const PostFeaturedImageBlock = createBlockDefinition<PostFeaturedImageContent>({
  id: 'post/featured-image',
  label: 'Featured Image',
  icon: ImageIcon,
  description: 'Display and set the post featured image',
  category: 'post',
  defaultContent: DEFAULT_CONTENT,
  defaultStyles: { width: '100%' },
  settings: PostFeaturedImageSettings,
  hasSettings: true,
  render: ({ content, styles, setContent, isPreview }) => (
    <PostFeaturedImageRenderer
      content={content}
      styles={styles}
      isEditor={!isPreview}
      onChangeUrl={(url) => setContent((prev) => ({ ...prev, url }))}
    />
  ),
});

export default PostFeaturedImageBlock;
