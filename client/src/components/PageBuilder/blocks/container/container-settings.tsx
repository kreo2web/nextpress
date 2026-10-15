import React from "react";
import type { BlockConfig, BlockContent, TokenEntry } from "@shared/schema-types";
import { Label } from "@/components/ui/label";
import { DimensionPresetField } from "../../dimension-preset-field";
import { SpacingField } from "../../spacing-field";
import { buildSpacingStyles, readSpacingSides, type SpacingPatch } from "../../spacing-styles";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Layout, Palette, Ruler } from "lucide-react";
import { useSettingsState } from "../useSettingsState";
import ColorField, { type ColorTarget } from "../../ColorField";
import { SettingsChipGroup } from "../../settings-chip-group";
import {
  type ContainerContent,
  DEFAULT_CONTENT,
  MAX_WIDTH_PRESETS,
  WIDTH_PRESETS,
  MIN_HEIGHT_PRESETS,
} from "./container-model";
import { BORDER_RADIUS_PRESETS } from "@shared/dimension-presets";

export interface ContainerSettingsProps {
  block: BlockConfig;
  onUpdate?: (updates: Partial<BlockConfig>) => void;
}

type ContainerHtmlTag = "div" | "section" | "article" | "aside";

const HTML_TAG_OPTIONS: Array<{
  value: ContainerHtmlTag;
  label: string;
  accessibleName: string;
}> = [
  { value: "div", label: "Group", accessibleName: "Group (div)" },
  { value: "section", label: "Section", accessibleName: "Section" },
  { value: "article", label: "Article", accessibleName: "Article" },
  { value: "aside", label: "Side note", accessibleName: "Side note" },
];

function isContainerHtmlTag(value: string): value is ContainerHtmlTag {
  return value === "div" || value === "section" || value === "article" || value === "aside";
}

export function ContainerSettings({ block, onUpdate }: ContainerSettingsProps) {
  const { accessor, rerender } = useSettingsState({ block, onUpdate });

  const content = accessor
    ? (accessor.getContent() as ContainerContent)
    : ((block.content as ContainerContent) || DEFAULT_CONTENT);
  const styles = accessor ? accessor.getStyles() : block.styles;

  const updateContent = (updates: Partial<ContainerContent>) => {
    if (accessor) {
      const current = accessor.getContent() as ContainerContent;
      accessor.setContent({ ...current, ...updates });
      rerender();
    } else if (onUpdate) {
      onUpdate({
        content: { ...DEFAULT_CONTENT, ...block.content, ...updates } as BlockContent,
      });
    }
  };

  const updateStyles = (styleUpdates: Partial<React.CSSProperties>) => {
    if (accessor) {
      const current = accessor.getStyles() || {};
      accessor.setStyles({ ...current, ...styleUpdates });
      rerender();
    } else if (onUpdate) {
      onUpdate({
        styles: { ...block.styles, ...styleUpdates },
      });
    }
  };

  const savedStyles = (styles ?? {}) as Record<string, unknown>;

  /**
   * Padding goes through the same style patch as the Style tab, so an older one-box value is split into
   * sides and never left to fight a longhand.
   */
  const commitPadding = (patch: SpacingPatch) => {
    const live = (accessor?.getStyles() ?? {}) as Record<string, unknown>;
    const resolved = { ...(block.styles as Record<string, unknown> | undefined), ...live };
    const previous = ((accessor ? accessor.getStyles() : block.styles) ?? {}) as Record<string, unknown>;
    updateStyles(buildSpacingStyles({ resolved, previous, patch }) as React.CSSProperties);
  };

  /** A token beats the plain style of the same name, so drop the style when a token is set. */
  const clearColorStyleWhileToken = (key: "backgroundColor" | "color") => {
    if (accessor) {
      const current = accessor.getStyles() || {};
      if (key in current) {
        const { [key]: _removed, ...rest } = current;
        accessor.setStyles(rest);
        rerender();
      }
    } else if (onUpdate && block.styles?.[key] != null) {
      const { [key]: _removed, ...rest } = block.styles;
      onUpdate({ styles: rest });
    }
  };

  const mergeTokenEntry = (entry: TokenEntry) => {
    const currentOther = block.other || {};
    onUpdate?.({
      other: {
        ...currentOther,
        tokenMap: {
          ...(currentOther.tokenMap || {}),
          [entry.property]: entry,
        },
      },
    });
  };

  /** Hands the colour back to the page's theme: drop the token and any plain style of the same name. */
  const followTheme = (target: ColorTarget) => {
    const key = target.property === "color" ? "color" : "backgroundColor";
    clearColorStyleWhileToken(key);
    const currentOther = block.other || {};
    onUpdate?.({
      other: {
        ...currentOther,
        tokenMap: { ...(currentOther.tokenMap || {}), [key]: null } as Record<string, TokenEntry>,
      },
    });
  };

  const handleColorTokenChange = (entry: TokenEntry) => {
    clearColorStyleWhileToken(entry.property === "color" ? "color" : "backgroundColor");
    mergeTokenEntry(entry);
  };

  const currentTag = content?.tagName || "div";

  const maxW = (styles?.maxWidth as string) || "";

  const widthRaw = (styles?.width as string) || "";

  const minH = (styles?.minHeight as string) || "";

  return (
    <div className="space-y-4">
      <CollapsibleCard title="Structure" icon={Layout} defaultOpen>
        <div className="space-y-3">
          <SettingsChipGroup
            label="HTML tag"
            options={HTML_TAG_OPTIONS}
            value={currentTag}
            onChange={(value) => {
              if (!isContainerHtmlTag(value)) return;
              updateContent({ tagName: value });
            }}
          />
          <p className="npb-settings-hint-muted text-xs">
            Wrapper classes: use the sidebar <span className="font-semibold">Advanced</span> tab → CSS Classes (same
            field as other blocks).
          </p>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Sizing" icon={Ruler} defaultOpen={false}>
        <div className="space-y-4">
          <DimensionPresetField
            label="Max width"
            presets={MAX_WIDTH_PRESETS}
            value={maxW || undefined}
            onChange={(next) => updateStyles({ maxWidth: next })}
            customPlaceholder="e.g. 72"
          />
          <DimensionPresetField
            label="Width"
            presets={WIDTH_PRESETS}
            value={widthRaw || undefined}
            onChange={(next) => updateStyles({ width: next })}
          />
          <DimensionPresetField
            label="Min height"
            presets={MIN_HEIGHT_PRESETS}
            value={minH || undefined}
            onChange={(next) => updateStyles({ minHeight: next })}
          />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Style" icon={Palette} defaultOpen={false}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="npb-settings-label text-sm font-medium">Colors</Label>
            <ColorField
              ariaLabel="Container color"
              defaultProperty="backgroundColor"
              targets={[
                {
                  property: "backgroundColor",
                  label: "Background",
                  entry: block.other?.tokenMap?.backgroundColor,
                  styleValue: styles?.backgroundColor as string | undefined,
                },
                {
                  property: "color",
                  label: "Text",
                  entry: block.other?.tokenMap?.color,
                  styleValue: styles?.color as string | undefined,
                },
              ]}
              onChange={handleColorTokenChange}
              onTheme={followTheme}
            />
          </div>
          <SpacingField
            targets={[{ kind: "padding", sides: readSpacingSides({ styles: savedStyles, kind: "padding" }) }]}
            onCommit={commitPadding}
          />
          <DimensionPresetField
            label="Border radius"
            presets={BORDER_RADIUS_PRESETS}
            value={(styles?.borderRadius as string) || undefined}
            onChange={(next) => updateStyles({ borderRadius: next })}
            customPlaceholder="e.g. 8"
          />
        </div>
      </CollapsibleCard>
    </div>
  );
}
