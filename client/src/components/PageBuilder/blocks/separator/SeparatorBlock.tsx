import React from "react";
import type { BlockConfig, TokenEntry } from "@shared/schema-types";
import type { DimensionPreset } from "@shared/dimension-presets";
import { SettingsLabel, SettingsSection } from '../../shared';
import ColorField from "../../ColorField";
import { DimensionPresetField } from "../../dimension-preset-field";
import { Minus as SeparatorIcon } from "lucide-react";
import { createBlockDefinition } from "../createBlockDefinition";
import { BlockShell } from "../shared/block-shell";
import { useSettingsState } from "../useSettingsState";

// ============================================================================
// TYPES
// ============================================================================

type SeparatorContent = {
  className?: string;
};

const DEFAULT_CONTENT: SeparatorContent = {
  className: '',
};

/** Short / Medium / Full — local to this block, not a shared preset list. */
const SEPARATOR_WIDTH_PRESETS: readonly DimensionPreset[] = [
  { value: "100px", label: "Short" },
  { value: "40%", label: "Medium" },
  { value: "100%", label: "Full" },
];

// ============================================================================
// RENDERER
// ============================================================================

type SeparatorRendererProps = {
  content: SeparatorContent;
  styles?: React.CSSProperties;
};

function SeparatorRenderer({ content, styles }: SeparatorRendererProps) {
  return (
    <BlockShell
      as="hr"
      blockClass="wp-block-separator"
      className={content?.className}
      style={{
        ...styles,
        border: "none",
        borderTop: "1px solid currentColor",
        backgroundColor: "currentColor",
        height: "1px",
        opacity: 1,
      }}
    />
  );
}

// ============================================================================
// SETTINGS COMPONENT
// ============================================================================

type SeparatorSettingsProps = {
  block: BlockConfig;
  onUpdate?: (updates: Partial<BlockConfig>) => void;
};

function readLineColor(color: React.CSSProperties["color"]): string | undefined {
  return typeof color === "string" && color.trim() !== "" ? color : undefined;
}

function readWidth(width: React.CSSProperties["width"]): string | undefined {
  if (width === undefined || width === null) return undefined;
  const text = String(width).trim();
  return text !== "" ? text : undefined;
}

function SeparatorSettings({ block, onUpdate }: SeparatorSettingsProps) {
  const { styles, updateStyles } = useSettingsState<SeparatorContent>({
    block,
    onUpdate,
    defaultContent: DEFAULT_CONTENT,
  });

  const pickLineColor = (entry: TokenEntry) => {
    if (typeof entry.style === "string" && entry.style.trim() !== "") {
      updateStyles({ color: entry.style });
    }
  };

  return (
    <SettingsSection>
      <div className="space-y-2">
        <SettingsLabel>Line</SettingsLabel>
        <ColorField
          ariaLabel="Line"
          targets={[
            {
              property: "color",
              label: "Line",
              styleValue: readLineColor(styles?.color),
            },
          ]}
          onChange={pickLineColor}
          onTheme={() => updateStyles({ color: null } as Partial<React.CSSProperties>)}
        />
      </div>
      <DimensionPresetField
        label="Width"
        presets={SEPARATOR_WIDTH_PRESETS}
        value={readWidth(styles?.width)}
        defaultValue="100px"
        onChange={(next) =>
          updateStyles({ width: next ?? null } as Partial<React.CSSProperties>)
        }
      />
    </SettingsSection>
  );
}

// ============================================================================
// BLOCK DEFINITION
// ============================================================================

const SeparatorBlock = createBlockDefinition<SeparatorContent>({
  id: 'core/separator',
  label: 'Separator',
  icon: SeparatorIcon,
  description: 'A short centered line.',
  category: 'layout',
  defaultContent: DEFAULT_CONTENT,
  defaultStyles: {
    color: '#000000',
    width: '100px',
    margin: '2.5em auto',
  },
  settings: SeparatorSettings,
  hasSettings: true,
  render: ({ content, styles }) => <SeparatorRenderer content={content} styles={styles} />,
});

export default SeparatorBlock;
