import React from "react";
import type { BlockConfig, TokenEntry } from "@shared/schema-types";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { SettingsLabel } from '../../shared';
import ColorField from "../../ColorField";
import { Minus as MinusIcon, Settings } from "lucide-react";
import { createBlockDefinition } from "../createBlockDefinition";
import { useSettingsState } from "../useSettingsState";
import { DIVIDER_DEFAULT_CONTENT } from "@shared/block-catalog/text-blocks";
import { catalogMeta } from "../catalog-meta";

// ============================================================================
// TYPES
// ============================================================================

type DividerLineStyle = "solid" | "dashed" | "dotted";

type DividerContent = {
  style?: DividerLineStyle;
  color?: string;
  width?: number;
};

function readDividerLineStyle(style: string | undefined): DividerLineStyle {
  if (style === "solid" || style === "dashed" || style === "dotted") return style;
  return "solid";
}

function readLineColor(color: string | undefined): string | undefined {
  return typeof color === "string" && color.trim() !== "" ? color : undefined;
}

const DEFAULT_CONTENT: DividerContent = DIVIDER_DEFAULT_CONTENT;

// ============================================================================
// RENDERER
// ============================================================================

interface DividerRendererProps {
  content: DividerContent;
  styles?: React.CSSProperties;
}

function DividerRenderer({ content, styles }: DividerRendererProps) {
  return (
    <div style={{ padding: styles?.padding, margin: styles?.margin }}>
      <hr
        style={{
          borderStyle: readDividerLineStyle(content?.style),
          borderWidth: '1px 0 0 0',
          borderColor: content?.color,
          width: `${content?.width || 100}%`,
          margin: '0 auto',
        }}
      />
    </div>
  );
}

// ============================================================================
// SETTINGS COMPONENT
// ============================================================================

interface DividerSettingsProps {
  block: BlockConfig;
  onUpdate?: (updates: Partial<BlockConfig>) => void;
}

function DividerSettings({ block, onUpdate }: DividerSettingsProps) {
  const { content, updateContent } = useSettingsState<DividerContent>({
    block,
    onUpdate,
    defaultContent: DEFAULT_CONTENT,
  });

  const pickLineColor = (entry: TokenEntry) => {
    if (typeof entry.style === "string" && entry.style.trim() !== "") {
      updateContent({ color: entry.style });
    }
  };

  return (
    <div className="space-y-4">
      {/* Content Card */}
      <CollapsibleCard title="Content" icon={MinusIcon} defaultOpen={true}>
        <div className="space-y-4">
          <div>
            <SettingsLabel htmlFor="divider-style">Line Style</SettingsLabel>
            <Select
              value={readDividerLineStyle(content?.style)}
              onValueChange={(value) => updateContent({ style: readDividerLineStyle(value) })}
            >
              <SelectTrigger id="divider-style" className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="solid">Solid</SelectItem>
                <SelectItem value="dashed">Dashed</SelectItem>
                <SelectItem value="dotted">Dotted</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <SettingsLabel>Line</SettingsLabel>
            <ColorField
              ariaLabel="Line"
              targets={[
                {
                  property: "color",
                  label: "Line",
                  styleValue: readLineColor(content?.color),
                },
              ]}
              onChange={pickLineColor}
              onTheme={() => updateContent({ color: null } as Partial<DividerContent>)}
            />
          </div>
        </div>
      </CollapsibleCard>

      {/* Settings Card */}
      <CollapsibleCard title="Settings" icon={Settings} defaultOpen={false}>
        <div className="space-y-4">
          <div>
            <SettingsLabel htmlFor="divider-width">Width (%)</SettingsLabel>
            <div className="flex items-center space-x-4 mt-1">
              <Slider
                aria-label="Divider width percentage"
                value={[content?.width || 100]}
                onValueChange={([value]) => updateContent({ width: value })}
                max={100}
                min={10}
                step={5}
                className="flex-1"
              />
              <Input
                id="divider-width"
                type="number"
                value={content?.width || 100}
                onChange={(e) => updateContent({ width: parseInt(e.target.value) || 100 })}
                className="w-20 h-9"
              />
            </div>
          </div>
        </div>
      </CollapsibleCard>
    </div>
  );
}

// ============================================================================
// BLOCK DEFINITION
// ============================================================================

const DividerBlock = createBlockDefinition<DividerContent>({
  ...catalogMeta('core/divider'),
  icon: MinusIcon,
  defaultContent: DEFAULT_CONTENT,
  settings: DividerSettings,
  hasSettings: true,
  render: ({ content, styles }) => <DividerRenderer content={content} styles={styles} />,
});

export default DividerBlock;
