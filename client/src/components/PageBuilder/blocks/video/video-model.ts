/**
 * Video block data model: content shape and pure YouTube URL helpers. Defaults live in shared/block-catalog.
 * No React here — see `video-settings.tsx` for the editor UI.
 */

import type { BlockContent } from "@shared/schema-types";

// ============================================================================
// TYPES
// ============================================================================

export type VideoContent = BlockContent & {
  poster?: string;
  controls?: boolean;
  autoplay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  preload?: string;
  /** `cover` fills the box and crops; `contain` shows the whole frame (shared/video-playback.ts). */
  objectFit?: 'cover' | 'contain';
  align?: 'default' | 'wide' | 'full';
  caption?: string;
  anchor?: string;
  className?: string;
  sources?: Array<{ src: string; type: string }>;
  id?: number;
};

export {
  isYouTubeUrl,
  extractYouTubeId,
  parseStartSeconds,
  buildYouTubeEmbedUrl,
  type YouTubeEmbedOptions,
} from "@shared/video-embed";

// ============================================================================
// UTILITIES
// ============================================================================
// Note: YouTube URL utilities are now re-exported from @shared/video-embed.
