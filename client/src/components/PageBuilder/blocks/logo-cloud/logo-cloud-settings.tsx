import React, { useState } from "react";
import type { BlockConfig, Media } from "@shared/schema-types";
import { AlertTriangle, ArrowDown, ArrowUp, Images, LayoutGrid, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import MediaPickerDialog from "@/components/media/MediaPickerDialog";
import { MAX_LOGOS, DEFAULT_LOGO_CLOUD_CONTENT, readLogoCloudContent, type LogoCloudContent, type LogoItem } from "@shared/blocks/logo-cloud-model";
import { SettingsLabel } from "../../shared";
import { SettingsChipGroup } from "../../settings-chip-group";
import { useSettingsState } from "../useSettingsState";

type LogoCloudSettingsProps = {
  block: BlockConfig;
  onUpdate?: (updates: Partial<BlockConfig>) => void;
};

const LAYOUT_OPTIONS = [
  { value: "row", label: "Row" },
  { value: "grid", label: "Grid" },
];
const HEIGHT_OPTIONS = ["32", "40", "48", "56"].map((px) => ({ value: `${px}px`, label: `${px}px` }));
const COLUMN_OPTIONS = ["2", "3", "4", "5", "6", "7", "8"].map((n) => ({ value: n, label: n }));

/** Moves the item at `index` one step; out-of-range moves return the list unchanged. */
function moveLogo({ logos, index, step }: { logos: LogoItem[]; index: number; step: -1 | 1 }): LogoItem[] {
  const target = index + step;
  if (target < 0 || target >= logos.length) return logos;
  const next = [...logos];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/** Settings for the logo cloud: the logo list, then layout, height and motion. */
export function LogoCloudSettings({ block, onUpdate }: LogoCloudSettingsProps) {
  const { content, updateContent } = useSettingsState<LogoCloudContent>({
    block,
    onUpdate,
    defaultContent: DEFAULT_LOGO_CLOUD_CONTENT,
    parseContent: (raw) => readLogoCloudContent(raw),
  });
  const [isPickerOpen, setPickerOpen] = useState(false);
  const data = content;
  const { logos } = data;
  const isRow = data.layout === "row";

  const setLogos = (next: LogoItem[]) => updateContent({ logos: next });
  const updateLogo = ({ index, updates }: { index: number; updates: Partial<LogoItem> }) =>
    setLogos(logos.map((logo, i) => (i === index ? { ...logo, ...updates } : logo)));
  const addLogo = (item: Media) =>
    setLogos([...logos, { url: item.url, alt: item.alt || "", href: "" }].slice(0, MAX_LOGOS));
  const isFull = logos.length >= MAX_LOGOS;

  return (
    <div className="space-y-4">
      <CollapsibleCard title="Logos" icon={Images} defaultOpen={true}>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <SettingsLabel>Logos ({logos.length})</SettingsLabel>
            <Button type="button" variant="outline" size="sm" disabled={isFull} onClick={() => setPickerOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Add logo
            </Button>
          </div>
          {isFull && <p className="text-xs text-npb-text-muted">You can show up to {MAX_LOGOS} logos.</p>}
          <MediaPickerDialog open={isPickerOpen} onOpenChange={setPickerOpen} kind="image" onSelect={addLogo} />

          {logos.length === 0 && <p className="text-xs text-npb-text-muted">No logos yet. Add one from your media library.</p>}

          <ul className="space-y-3" aria-label="Logos">
            {logos.map((logo, index) => (
              <li key={`${logo.url}-${index}`} className="space-y-2 rounded border border-npb-border-default p-2">
                <div className="flex items-center gap-2">
                  <img src={logo.url} alt="" className="h-10 w-16 shrink-0 rounded bg-transparent object-contain" />
                  <div className="ml-auto flex items-center">
                    <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0" disabled={index === 0} aria-label={`Move logo ${index + 1} up`} onClick={() => setLogos(moveLogo({ logos, index, step: -1 }))}>
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0" disabled={index === logos.length - 1} aria-label={`Move logo ${index + 1} down`} onClick={() => setLogos(moveLogo({ logos, index, step: 1 }))}>
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="ghost" size="sm" className="h-9 w-9 p-0" aria-label={`Remove logo ${index + 1}`} onClick={() => setLogos(logos.filter((_, i) => i !== index))}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <SettingsLabel htmlFor={`logo-alt-${index}`}>Alt text</SettingsLabel>
                  <Input id={`logo-alt-${index}`} className="mt-1 h-9" value={logo.alt} placeholder="Company name" aria-label={`Alt text for logo ${index + 1}`} onChange={(e) => updateLogo({ index, updates: { alt: e.target.value } })} />
                  {!logo.alt.trim() && (
                    <p role="alert" className="mt-1 flex items-center gap-1 text-xs text-npb-text-muted">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      Add the company name so screen readers can say it.
                    </p>
                  )}
                </div>
                <div>
                  <SettingsLabel htmlFor={`logo-href-${index}`}>Link</SettingsLabel>
                  <Input id={`logo-href-${index}`} className="mt-1 h-9" value={logo.href} placeholder="https://example.com (optional)" aria-label={`Link for logo ${index + 1}`} onChange={(e) => updateLogo({ index, updates: { href: e.target.value } })} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Layout" icon={LayoutGrid} defaultOpen={true}>
        <div className="space-y-4">
          <SettingsChipGroup label="Layout" options={LAYOUT_OPTIONS} value={data.layout} onChange={(value) => updateContent({ layout: value === "grid" ? "grid" : "row" })} />
          {!isRow && <SettingsChipGroup label="Columns" options={COLUMN_OPTIONS} value={String(data.columns)} onChange={(value) => updateContent({ columns: Number(value) })} />}
          <SettingsChipGroup label="Logo height" options={HEIGHT_OPTIONS} value={data.logoHeight} onChange={(value) => updateContent({ logoHeight: value })} />
          <div className="flex items-center justify-between">
            <SettingsLabel htmlFor="logo-grayscale">Grayscale</SettingsLabel>
            <Switch id="logo-grayscale" checked={data.grayscale} onCheckedChange={(checked) => updateContent({ grayscale: checked })} />
          </div>
          <div className="flex items-center justify-between">
            <SettingsLabel htmlFor="logo-scroll">Scroll</SettingsLabel>
            <Switch id="logo-scroll" checked={data.marquee} disabled={!isRow} onCheckedChange={(checked) => updateContent({ marquee: checked })} />
          </div>
          {!isRow && <p className="text-xs text-npb-text-muted">Scrolling is only available in the row layout.</p>}
        </div>
      </CollapsibleCard>
    </div>
  );
}
