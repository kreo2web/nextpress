/**
 * Cover block data model: data/content shapes. Defaults live in shared/block-catalog. No React here — see
 * `cover-settings.tsx` for the UI and `CoverBlock.tsx` for the renderer.
 */

import type { BlockContent } from '@shared/schema-types';

// ============================================================================
// TYPES
// ============================================================================

export type CoverData = {
  url?: string;
  alt?: string;
  hasParallax?: boolean;
  dimRatio?: number;
  overlayColor?: string;
  minHeight?: number;
  contentPosition?: string;
  customOverlayColor?: string;
  backgroundType?: 'image' | 'video';
  focalPoint?: { x: number; y: number };
  innerContent?: string;
  className?: string;
};

export type CoverContent = BlockContent & {
  data?: CoverData;
};

