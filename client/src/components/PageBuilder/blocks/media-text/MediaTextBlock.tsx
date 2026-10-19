import React from "react";
import { Image as ImageIcon } from "lucide-react";
import { readStructuredBlockData } from "@shared/read-block-content";
import { sanitizeHtml } from "../../utils";
import { createBlockDefinition } from "../createBlockDefinition";
import { BlockShell } from "../shared/block-shell";
import { type MediaTextContent, type MediaTextData } from './media-text-model';
import { MEDIA_TEXT_DEFAULT_CONTENT, MEDIA_TEXT_DEFAULT_DATA } from '@shared/block-catalog/media-blocks';
import { catalogMeta } from '../catalog-meta';
import { MediaTextSettings } from './media-text-settings';
import { mediaTextAlignItems, mediaTextPaneBasis } from '@shared/media-text-layout';

const DEFAULT_DATA: MediaTextData = MEDIA_TEXT_DEFAULT_DATA;

// ============================================================================
// RENDERER
// ============================================================================

interface MediaTextRendererProps {
  content: MediaTextContent;
  styles?: React.CSSProperties;
}

function MediaTextRenderer({ content, styles }: MediaTextRendererProps) {
  const blockData = readStructuredBlockData(content, DEFAULT_DATA);

  const {
    mediaUrl,
    mediaAlt,
    mediaPosition = 'left',
    mediaWidth = 50,
    isStackedOnMobile = true,
    imageFill = false,
    verticalAlignment = 'center',
    href,
    linkTarget,
    rel,
    title,
    content: textContent,
    className,
    anchor,
  } = blockData;

  const extraClassName = [
    mediaPosition === 'right' ? 'has-media-on-the-right' : '',
    isStackedOnMobile ? 'is-stacked-on-mobile' : '',
    imageFill ? 'is-image-fill' : '',
    className || '',
  ]
    .filter(Boolean)
    .join(' ');

  const alignItems = mediaTextAlignItems(verticalAlignment);
  const paneBasis = mediaTextPaneBasis(mediaWidth);

  const mediaStyle: React.CSSProperties = imageFill
    ? { backgroundImage: mediaUrl ? `url(${mediaUrl})` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }
    : {};

  const mediaInner = imageFill ? null : (
    mediaUrl ? <img src={mediaUrl} alt={mediaAlt || ''} style={{ maxWidth: '100%', height: 'auto' }} /> : null
  );

  const mediaContent = href ? (
    <a href={href} target={linkTarget} rel={rel} title={title} className="wp-block-media-text__media" style={{ ...mediaStyle, flexBasis: paneBasis.media, minWidth: 0 }}>
      {mediaInner}
    </a>
  ) : (
    <div className="wp-block-media-text__media" style={{ ...mediaStyle, flexBasis: paneBasis.media, minWidth: 0 }}>
      {mediaInner}
    </div>
  );

  return (
    <BlockShell
      blockClass="wp-block-media-text"
      className={extraClassName || undefined}
      id={anchor}
      style={{ ...styles, display: 'flex', gap: '20px', alignItems }}
    >
      {mediaPosition === 'left' ? (
        <>
          {mediaContent}
          <div className="wp-block-media-text__content" style={{ flexBasis: paneBasis.text, minWidth: 0 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(textContent || '<p>Add text…</p>') }} />
        </>
      ) : (
        <>
          <div className="wp-block-media-text__content" style={{ flexBasis: paneBasis.text, minWidth: 0 }} dangerouslySetInnerHTML={{ __html: sanitizeHtml(textContent || '<p>Add text…</p>') }} />
          {mediaContent}
        </>
      )}
    </BlockShell>
  );
}

// ============================================================================
// BLOCK DEFINITION
// ============================================================================

const MediaTextBlock = createBlockDefinition<MediaTextContent>({
  ...catalogMeta('core/media-text'),
  icon: ImageIcon,
  defaultContent: MEDIA_TEXT_DEFAULT_CONTENT,
  settings: MediaTextSettings,
  hasSettings: true,
  render: ({ content, styles }) => <MediaTextRenderer content={content} styles={styles} />,
});

export default MediaTextBlock;
