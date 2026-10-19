/**
 * Media & Text block data model: data/content shapes. Defaults live in shared/block-catalog. No React here
 * — see `media-text-settings.tsx` for the UI and `MediaTextBlock.tsx` for the
 * renderer.
 */

import type { BlockContent } from "@shared/schema-types";

// ============================================================================
// TYPES
// ============================================================================

export type MediaTextData = {
  mediaId?: number;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  mediaAlt?: string;
  mediaPosition?: 'left' | 'right';
  mediaWidth?: number;
  isStackedOnMobile?: boolean;
  imageFill?: boolean;
  verticalAlignment?: 'top' | 'center' | 'bottom';
  href?: string;
  linkTarget?: '_self' | '_blank';
  rel?: string;
  title?: string;
  content?: string;
  className?: string;
  anchor?: string;
};

export type MediaTextContent = BlockContent & {
  data?: MediaTextData;
};
