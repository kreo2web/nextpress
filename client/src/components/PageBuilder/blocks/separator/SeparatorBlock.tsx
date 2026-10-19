import React from "react";
import type { BlockConfig, TokenEntry } from "@shared/schema-types";
import type { DimensionPreset } from "@shared/dimension-presets";
import { SettingsLabel, SettingsSection } from '../../shared';
import ColorField from "../../ColorField";
import { DimensionPresetField } from "../../dimension-preset-field";
import { SettingsChipGroup } from "../../settings-chip-group";
import { Minus as SeparatorIcon } from "lucide-react";
import { createBlockDefinition } from "../createBlockDefinition";
import { BlockShell } from "../shared/block-shell";
import { useSettingsState } from "../useSettingsState";
import { SEPARATOR_DEFAULT_CONTENT } from "@shared/block-catalog/text-blocks";
import { catalogMeta } from "../catalog-meta";

// ============================================================================
// TYPES
// ============================================================================

type SeparatorLineStyle = "solid" | "dashed" | "dotted";

type SeparatorContent = {
  className?: string;
  lineStyle?: SeparatorLineStyle;
};

const DEFAULT_CONTENT: SeparatorContent = SEPARATOR_DEFAULT_CONTENT;

const LINE_STYLE_OPTIONS = [
  { value: "solid", label: "Solid" },
  { value: "dashed", label: "Dashed" },
  { value: "dotted", label: "Dotted" },
] as const;

function readLineStyle(value: string | undefined): SeparatorLineStyle {
  if (value === "dashed" || value === "dotted" || value === "solid") return value;
  return "solid";
}

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
  const lineStyle = readLineStyle(content?.lineStyle);
  return (
    <BlockShell
      as="hr"
      blockClass="wp-block-separator"
      className={content?.className}
      style={{
        ...styles,
        border: "none",
        borderTop: `1px ${lineStyle} currentColor`,
        backgroundColor: "transparent",
        height: 0,
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
  const { content, styles, updateContent, updateStyles } = useSettingsState<SeparatorContent>({
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
      <SettingsChipGroup
        label="Line style"
        options={[...LINE_STYLE_OPTIONS]}
        value={readLineStyle(content?.lineStyle)}
        onChange={(value) => updateContent({ lineStyle: readLineStyle(value) })}
      />
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
  ...catalogMeta('core/separator'),
  icon: SeparatorIcon,
  defaultContent: DEFAULT_CONTENT,
  settings: SeparatorSettings,
  hasSettings: true,
  render: ({ content, styles }) => <SeparatorRenderer content={content} styles={styles} />,
});

export default SeparatorBlock;
