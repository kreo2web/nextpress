import * as React from 'react';
import { useState, useEffect } from 'react';
import { BarChart3, Palette, Settings } from 'lucide-react';
import type { BlockDefinition, BlockComponentProps } from '../types.ts';
import type { BlockConfig, TokenEntry } from '@shared/schema-types';
import { SettingsLabel } from '../../shared';
import ColorField from '../../ColorField';
import { SettingsChipGroup } from '../../settings-chip-group';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { CollapsibleCard } from '@/components/ui/collapsible-card';
import { useSettingsState } from '../useSettingsState';
import { useBlockState } from '../useBlockState';
import { BlockShell } from '../shared/block-shell';
import { defaultParseContent, defaultSerializeContent } from '../createBlockDefinition';

// ============================================================================
// TYPES
// ============================================================================

export type PostProgressContent = {
  color?: string | null;
  height?: number;
  position?: 'top' | 'bottom';
  showPercentage?: boolean;
  backgroundColor?: string | null;
  className?: string;
};

const DEFAULT_BAR_COLOR = 'var(--npb-accent)';
const DEFAULT_BACKGROUND_COLOR = 'transparent';
const SAMPLE_HINT =
  'On the live page this follows reading. The canvas shows a sample.';

const DEFAULT_CONTENT: PostProgressContent = {
  color: DEFAULT_BAR_COLOR,
  height: 4,
  position: 'top',
  showPercentage: false,
  backgroundColor: DEFAULT_BACKGROUND_COLOR,
  className: '',
};

const EDITOR_PREVIEW_FILL = 40;

const POSITION_OPTIONS = [
  { value: 'top', label: 'Top' },
  { value: 'bottom', label: 'Bottom' },
];

function readBarColor(color: string | null | undefined): string {
  if (typeof color === 'string' && color.trim() !== '') return color;
  return DEFAULT_BAR_COLOR;
}

function readBackgroundColor(color: string | null | undefined): string {
  if (typeof color === 'string' && color.trim() !== '') return color;
  return DEFAULT_BACKGROUND_COLOR;
}

function barFollowsTheme(color: string | null | undefined): boolean {
  return color == null || color.trim() === '' || color === DEFAULT_BAR_COLOR;
}

function backgroundFollowsTheme(color: string | null | undefined): boolean {
  return (
    color == null || color.trim() === '' || color === DEFAULT_BACKGROUND_COLOR
  );
}

function readPosition(value: string | null | undefined): 'top' | 'bottom' {
  return value === 'bottom' ? 'bottom' : 'top';
}

function pickColorStyle(entry: TokenEntry): string | null {
  return typeof entry.style === 'string' && entry.style.trim() !== ''
    ? entry.style
    : null;
}

// ============================================================================
// HOOKS
// ============================================================================

/** Track scroll progress (0–100). Uses rAF debouncing. Only active when `enabled`. */
function useScrollProgress(enabled: boolean): number {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let rafId: number | null = null;
    const handleScroll = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(() => {
        const scrollable =
          document.documentElement.scrollHeight - window.innerHeight;
        const pct =
          scrollable > 0
            ? Math.min((window.scrollY / scrollable) * 100, 100)
            : 0;
        setProgress(Math.round(pct));
        rafId = null;
      });
    };
    handleScroll(); // initial position
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [enabled]);
  return progress;
}

// ============================================================================
// RENDERER
// ============================================================================

/**
 * Pure presentational renderer for the Reading Progress block.
 * Preview mode: fixed bar tracking scroll. Editor mode: static inline preview.
 */
function PostProgressRenderer({
  content,
  styles,
  isPreview,
}: {
  content: PostProgressContent;
  styles?: React.CSSProperties;
  isPreview?: boolean;
}) {
  const color = readBarColor(content?.color);
  const height = content?.height ?? DEFAULT_CONTENT.height!;
  const position = readPosition(content?.position);
  const showPercentage = content?.showPercentage ?? false;
  const backgroundColor = readBackgroundColor(content?.backgroundColor);

  const scrollProgress = useScrollProgress(!!isPreview);
  const fillWidth = isPreview ? scrollProgress : EDITOR_PREVIEW_FILL;

  // --- Preview mode: fixed bar attached to viewport edge ---
  if (isPreview) {
    const positionStyles: React.CSSProperties = {
      position: 'fixed',
      left: 0,
      right: 0,
      zIndex: 50,
      ...(position === 'top' ? { top: 0 } : { bottom: 0 }),
    };

    return (
      <BlockShell
        blockClass="wp-block-post-progress"
        className={content?.className}
        style={{ ...positionStyles, height, backgroundColor, ...styles }}
      >
        <div
          style={{
            height: '100%',
            width: `${fillWidth}%`,
            backgroundColor: color,
            transition: 'width 100ms linear',
          }}
        />
        {showPercentage && (
          <span
            style={{
              position: 'absolute',
              [position === 'top' ? 'top' : 'bottom']: height + 4,
              right: 8,
              fontSize: '0.7rem',
              fontWeight: 600,
              color,
              lineHeight: 1,
              pointerEvents: 'none',
            }}>
            {fillWidth}%
          </span>
        )}
      </BlockShell>
    );
  }

  // --- Editor mode: inline static preview ---
  return (
    <BlockShell blockClass="wp-block-post-progress" className={content?.className} style={styles}>
      <div
        style={{
          position: 'relative',
          height,
          backgroundColor,
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid var(--npb-border-default)',
        }}>
        <div
          style={{
            height: '100%',
            width: `${fillWidth}%`,
            backgroundColor: color,
            borderRadius: 2,
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 6,
        }}>
        <span className="text-xs text-npb-text-secondary font-medium">
          Reading Progress Bar
        </span>
        <span className="text-xs text-npb-text-muted italic">
          {SAMPLE_HINT}
        </span>
      </div>
    </BlockShell>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function PostProgressBlockComponent({
  value,
  onChange,
  isPreview,
}: BlockComponentProps) {
  const { content, styles } = useBlockState<PostProgressContent>({
    value,
    getDefaultContent: () => DEFAULT_CONTENT,
    onChange,
    parseContent: defaultParseContent,
    serializeContent: defaultSerializeContent,
  });

  return (
    <PostProgressRenderer
      content={content}
      styles={styles}
      isPreview={isPreview}
    />
  );
}

// ============================================================================
// SETTINGS COMPONENT
// ============================================================================

/** Sidebar settings panel for the Reading Progress block. */
function PostProgressSettings({
  block,
  onUpdate,
}: {
  block: BlockConfig;
  onUpdate?: (updates: Partial<BlockConfig>) => void;
}) {
  const { content, updateContent } = useSettingsState<PostProgressContent>({
    block,
    onUpdate,
    defaultContent: DEFAULT_CONTENT,
    parseContent: defaultParseContent,
    serializeContent: defaultSerializeContent,
  });

  const barIsTheme = barFollowsTheme(content?.color);
  const backgroundIsTheme = backgroundFollowsTheme(content?.backgroundColor);

  return (
    <div className="space-y-4">
      <p className="npb-settings-hint-muted text-xs">{SAMPLE_HINT}</p>

      <CollapsibleCard title="Appearance" icon={Palette} defaultOpen>
        <div className="space-y-4">
          <div className="space-y-2">
            <SettingsLabel>Bar</SettingsLabel>
            <ColorField
              ariaLabel="Bar"
              targets={[
                {
                  property: 'color',
                  label: 'Bar',
                  styleValue: barIsTheme ? undefined : (content?.color ?? undefined),
                  followsTheme: barIsTheme,
                },
              ]}
              onChange={(entry) => {
                const next = pickColorStyle(entry);
                if (next) updateContent({ color: next });
              }}
              onTheme={() => updateContent({ color: null })}
            />
          </div>

          <div className="space-y-2">
            <SettingsLabel>Background</SettingsLabel>
            <ColorField
              ariaLabel="Background"
              targets={[
                {
                  property: 'backgroundColor',
                  label: 'Background',
                  styleValue: backgroundIsTheme
                    ? undefined
                    : (content?.backgroundColor ?? undefined),
                  followsTheme: backgroundIsTheme,
                },
              ]}
              onChange={(entry) => {
                const next = pickColorStyle(entry);
                if (next) updateContent({ backgroundColor: next });
              }}
              onTheme={() => updateContent({ backgroundColor: null })}
            />
          </div>

          <div>
            <SettingsLabel htmlFor="progress-height">Height (px)</SettingsLabel>
            <Input
              id="progress-height"
              type="number"
              min={2}
              max={12}
              value={content?.height ?? DEFAULT_CONTENT.height}
              onChange={(e) => {
                const val = Math.max(2, Math.min(12, Number(e.target.value)));
                updateContent({ height: val });
              }}
              className="mt-1 h-9 text-sm"
            />
          </div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Placement" icon={Settings} defaultOpen={false}>
        <div className="space-y-4">
          <SettingsChipGroup
            label="Position"
            options={POSITION_OPTIONS}
            value={readPosition(content?.position)}
            onChange={(value) => updateContent({ position: readPosition(value) })}
          />

          <div className="flex items-center justify-between">
            <SettingsLabel htmlFor="progress-percentage">
              Show Percentage
            </SettingsLabel>
            <Switch
              id="progress-percentage"
              checked={content?.showPercentage ?? false}
              onCheckedChange={(checked) =>
                updateContent({ showPercentage: checked })
              }
            />
          </div>
        </div>
      </CollapsibleCard>
    </div>
  );
}

// ============================================================================
// BLOCK DEFINITION
// ============================================================================

/**
 * Post Reading Progress block definition for the PageBuilder.
 * Fixed progress bar that fills as the reader scrolls. Static inline preview in editor.
 */
const PostProgressBlock: BlockDefinition = {
  id: 'post/progress',
  label: 'Reading Progress',
  icon: BarChart3,
  description: 'Show a reading progress indicator bar',
  category: 'post',
  defaultContent: DEFAULT_CONTENT,
  defaultStyles: {},
  component: PostProgressBlockComponent,
  settings: PostProgressSettings,
  hasSettings: true,
  parseContent: defaultParseContent,
  serializeContent: defaultSerializeContent,
};

export default PostProgressBlock;
