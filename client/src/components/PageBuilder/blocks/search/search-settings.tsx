import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { Input } from "@/components/ui/input";
import { SettingsLabel, SettingsSection } from "../../shared";
import { useSettingsState } from "../useSettingsState";
import { DEFAULT_SEARCH_CONTENT, readSearchContent, type SearchContent } from "@shared/blocks/search-model";

export function SearchSettings({ block, onUpdate }: { block: BlockConfig; onUpdate?: (updates: Partial<BlockConfig>) => void }) {
  const { content, updateContent } = useSettingsState<SearchContent>({
    block,
    onUpdate,
    defaultContent: DEFAULT_SEARCH_CONTENT,
    parseContent: readSearchContent,
  });

  return (
    <SettingsSection>
      <div className="space-y-2">
        <SettingsLabel htmlFor="search-label">Button text</SettingsLabel>
        <Input id="search-label" className="h-9" value={content.label} placeholder="Search" onChange={(event) => updateContent({ label: event.target.value })} />
      </div>
      <div className="space-y-2">
        <SettingsLabel htmlFor="search-placeholder">Hint in the search box</SettingsLabel>
        <Input
          id="search-placeholder"
          className="h-9"
          value={content.placeholder}
          placeholder="Search this site"
          onChange={(event) => updateContent({ placeholder: event.target.value })}
        />
        <p className="text-xs text-muted-foreground">Visitors open search with this button or Ctrl or ⌘ + K.</p>
      </div>
    </SettingsSection>
  );
}
