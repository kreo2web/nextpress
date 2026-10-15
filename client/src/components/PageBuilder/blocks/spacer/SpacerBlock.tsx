import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import type { DimensionPreset } from "@shared/dimension-presets";
import { SettingsSection } from '../../shared';
import { DimensionPresetField } from "../../dimension-preset-field";
import { Space as SpaceIcon } from "lucide-react";
import { createBlockDefinition } from "../createBlockDefinition";
import { BlockShell } from "../shared/block-shell";
import { useSettingsState } from "../useSettingsState";

// ============================================================================
// TYPES
// ============================================================================

type SpacerHeight = string | number | null;

type SpacerContent = {
  height?: SpacerHeight;
  anchor?: string;
  className?: string;
};

const DEFAULT_SPACER_HEIGHT = "100px";

/** Tight / Small / Medium / Large — local to this block, not the shared height list. */
const SPACER_HEIGHT_PRESETS: readonly DimensionPreset[] = [
  { value: "24px", label: "Tight" },
  { value: "48px", label: "Small" },
  { value: "100px", label: "Medium" },
  { value: "160px", label: "Large" },
];

const DEFAULT_CONTENT: SpacerContent = {
  height: DEFAULT_SPACER_HEIGHT,
  anchor: "",
  className: "",
};

/**
 * Legacy spacers store a pixel number (100). New writes are CSS lengths ("100px").
 * Missing or empty is unset so the caller can fall back to 100px.
 */
function readSpacerHeight(value: SpacerHeight | undefined): string | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}px`;
  }
  if (typeof value === "string" && value.trim() !== "") {
    return value;
  }
  return undefined;
}

function readStyleHeight(height: React.CSSProperties["height"]): string | undefined {
  if (typeof height === "number" && Number.isFinite(height)) {
    return `${height}px`;
  }
  if (typeof height === "string" && height.trim() !== "") {
    return height;
  }
  return undefined;
}

/**
 * Content height first, then a copy of style. Style height wins only when it is
 * actually set — an absent style height must not wipe the spacer value.
 */
function buildSpacerStyle(
  contentHeight: SpacerHeight | undefined,
  styles: React.CSSProperties | undefined,
): React.CSSProperties {
  const fromContent = readSpacerHeight(contentHeight) ?? DEFAULT_SPACER_HEIGHT;
  const spacerStyle: React.CSSProperties = {
    height: fromContent,
    ...styles,
  };
  const fromStyle = readStyleHeight(styles?.height);
  if (fromStyle !== undefined) {
    spacerStyle.height = fromStyle;
  } else {
    spacerStyle.height = fromContent;
  }
  return spacerStyle;
}

// ============================================================================
// RENDERER
// ============================================================================

type SpacerRendererProps = {
  content: SpacerContent;
  styles?: React.CSSProperties;
};

function SpacerRenderer({ content, styles }: SpacerRendererProps) {
  return (
    <BlockShell
      blockClass="wp-block-spacer"
      className={content?.className}
      style={buildSpacerStyle(content?.height, styles)}
      aria-hidden="true"
    />
  );
}

// ============================================================================
// SETTINGS COMPONENT
// ============================================================================

type SpacerSettingsProps = {
  block: BlockConfig;
  onUpdate?: (updates: Partial<BlockConfig>) => void;
};

function SpacerSettings({ block, onUpdate }: SpacerSettingsProps) {
  const { content, updateContent } = useSettingsState<SpacerContent>({
    block,
    onUpdate,
    defaultContent: DEFAULT_CONTENT,
  });

  return (
    <SettingsSection>
      <DimensionPresetField
        label="Height"
        presets={SPACER_HEIGHT_PRESETS}
        value={readSpacerHeight(content?.height) ?? DEFAULT_SPACER_HEIGHT}
        defaultValue={DEFAULT_SPACER_HEIGHT}
        onChange={(next) =>
          updateContent({ height: next ?? null } as Partial<SpacerContent>)
        }
      />
      <p className="npb-settings-hint-muted text-xs">
        Style height wins if both are set.
      </p>
    </SettingsSection>
  );
}

// ============================================================================
// BLOCK DEFINITION
// ============================================================================

const SpacerBlock = createBlockDefinition<SpacerContent>({
  id: 'core/spacer',
  label: 'Spacer',
  icon: SpaceIcon,
  description: 'Add vertical spacing',
  category: 'layout',
  defaultContent: DEFAULT_CONTENT,
  defaultStyles: {
    padding: '0px',
    margin: '0px',
  },
  settings: SpacerSettings,
  hasSettings: true,
  render: ({ content, styles }) => <SpacerRenderer content={content} styles={styles} />,
});

export default SpacerBlock;
