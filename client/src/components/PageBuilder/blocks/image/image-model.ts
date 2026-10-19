/**
 * Image block data model: content shape and the alignment-button class helper.
 * Defaults live in shared/block-catalog. No React here — see `image-settings.tsx` for the UI.
 */

// ============================================================================
// TYPES
// ============================================================================

export type ImageContent = {
  kind: 'media';
  url: string;
  alt?: string;
  caption?: string;
  mediaType: 'image' | 'video' | 'audio';
  align?: 'left' | 'center' | 'right' | 'wide' | 'full' | '';
  sizeSlug?: 'thumbnail' | 'medium' | 'large' | 'full';
  className?: string;
  linkDestination?: 'none' | 'media' | 'attachment' | 'custom';
  href?: string;
  linkTarget?: '_self' | '_blank';
  target?: string;
  rel?: string;
  title?: string;
  id?: string;
  /** Pixel size of the file, so the page can hold the box before the picture arrives. */
  intrinsicWidth?: string;
  intrinsicHeight?: string;
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
  aspectRatio?: string;
};

// ============================================================================
// UTILITIES
// ============================================================================

export const getAlignmentButtonClass = (isActive: boolean) =>
  `flex items-center gap-2 p-3 h-9 text-sm font-medium rounded-lg border transition-colors ${
    isActive
      ? 'bg-npb-interactive-bg-active text-npb-interactive-text-active border-npb-interactive-bg-active'
      : 'bg-npb-interactive-bg text-npb-interactive-text border-npb-border-default hover:bg-npb-interactive-bg-hover'
  }`;
