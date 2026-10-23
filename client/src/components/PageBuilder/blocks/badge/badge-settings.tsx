import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { Input } from "@/components/ui/input";
import { SettingsLabel, SettingsSection } from "../../shared";
import { SettingsChipGroup } from "../../settings-chip-group";
import { useSettingsState } from "../useSettingsState";
import {
  BADGE_LOOKS,
  BADGE_TONES,
  DEFAULT_BADGE_CONTENT,
  readBadgeContent,
  type BadgeContent,
  type BadgeLook,
  type BadgeTone,
} from "@shared/blocks/badge-model";

const TONE_OPTIONS: { value: BadgeTone; label: string }[] = [
  { value: "accent", label: "Accent" },
  { value: "neutral", label: "Neutral" },
  { value: "success", label: "Success" },
  { value: "warning", label: "Warning" },
  { value: "danger", label: "Danger" },
];

const LOOK_OPTIONS: { value: BadgeLook; label: string }[] = [
  { value: "soft", label: "Soft" },
  { value: "outline", label: "Outline" },
  { value: "solid", label: "Solid" },
];

/** Chip values arrive as strings; these keep only the words the model allows. */
function toBadgeTone(value: string): BadgeTone {
  return BADGE_TONES.find((tone) => tone === value) ?? "accent";
}

function toBadgeLook(value: string): BadgeLook {
  return BADGE_LOOKS.find((look) => look === value) ?? "soft";
}

/**
 * Settings for the badge: one group of controls, so there is no accordion (design system §16).
 * Tone and look are chips, since the set is small and fixed.
 */
export function BadgeSettings({ block, onUpdate }: { block: BlockConfig; onUpdate?: (updates: Partial<BlockConfig>) => void }) {
  const { content, updateContent } = useSettingsState<BadgeContent>({
    block,
    onUpdate,
    defaultContent: DEFAULT_BADGE_CONTENT,
    parseContent: readBadgeContent,
  });

  return (
    <SettingsSection>
      <div className="space-y-2">
        <SettingsLabel htmlFor="badge-text">Text</SettingsLabel>
        <Input
          id="badge-text"
          className="h-9"
          value={content.text}
          placeholder="New"
          onChange={(event) => updateContent({ text: event.target.value })}
        />
      </div>
      <SettingsChipGroup
        label="Tone"
        ariaLabel="Badge tone"
        options={TONE_OPTIONS}
        value={content.tone}
        onChange={(value) => updateContent({ tone: toBadgeTone(value) })}
      />
      <SettingsChipGroup
        label="Look"
        ariaLabel="Badge look"
        options={LOOK_OPTIONS}
        value={content.look}
        onChange={(value) => updateContent({ look: toBadgeLook(value) })}
      />
    </SettingsSection>
  );
}
