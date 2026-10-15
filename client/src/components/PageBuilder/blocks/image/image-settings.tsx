import React from "react";
import type { BlockConfig, BlockContent } from "@shared/schema-types";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Image as ImageIcon, AlignLeft, AlignCenter, AlignRight, Maximize, Settings, Link } from "lucide-react";
import { useSettingsState } from "../useSettingsState";
import { SettingsLabel } from '../../shared';
import { MediaUrlField } from "../shared/media-url-field";
import { LinkUrlField, LinkTargetSelect } from "../shared/link-settings";
import { SettingsChipGroup } from "../../settings-chip-group";
import { type ImageContent, DEFAULT_CONTENT } from "./image-model";

type ImageSettingsProps = {
  block: BlockConfig;
  onUpdate?: (updates: Partial<BlockConfig>) => void;
};

type FigureWidth = NonNullable<ImageContent["align"]>;
type ImageSizeSlug = NonNullable<ImageContent["sizeSlug"]>;
type ImageLinkDestination = "none" | "media" | "custom";

const FIGURE_WIDTH_OPTIONS = [
  { value: "", label: "Default", icon: AlignCenter, accessibleName: "Figure width Default" },
  { value: "left", label: "Left", icon: AlignLeft, accessibleName: "Figure width Left" },
  { value: "center", label: "Center", icon: AlignCenter, accessibleName: "Figure width Center" },
  { value: "right", label: "Right", icon: AlignRight, accessibleName: "Figure width Right" },
  { value: "wide", label: "Wide", icon: Maximize, accessibleName: "Figure width Wide" },
  { value: "full", label: "Full", icon: Maximize, accessibleName: "Figure width Full" },
];

const IMAGE_SIZE_OPTIONS = [
  { value: "thumbnail", label: "Thumbnail" },
  { value: "medium", label: "Medium" },
  { value: "large", label: "Large" },
  { value: "full", label: "Full" },
];

function isFigureWidth(value: string): value is FigureWidth {
  return (
    value === "" ||
    value === "left" ||
    value === "center" ||
    value === "right" ||
    value === "wide" ||
    value === "full"
  );
}

function isImageSizeSlug(value: string): value is ImageSizeSlug {
  return (
    value === "thumbnail" ||
    value === "medium" ||
    value === "large" ||
    value === "full"
  );
}

function isImageLinkDestination(value: string): value is ImageLinkDestination {
  return value === "none" || value === "media" || value === "custom";
}

export function ImageSettings({ block, onUpdate }: ImageSettingsProps) {
  const { accessor, rerender } = useSettingsState({ block, onUpdate });

  // Get current state
  const content = accessor
    ? (accessor.getContent() as ImageContent)
    : (block.content as ImageContent) || DEFAULT_CONTENT;

  // Update handlers
  const updateContent = (updates: Partial<ImageContent>) => {
    if (accessor) {
      const current = accessor.getContent() as ImageContent;
      accessor.setContent({ ...current, ...updates } as ImageContent);
      rerender();
    } else if (onUpdate) {
      onUpdate({
        content: {
          ...block.content,
          ...updates,
        } as BlockContent,
      });
    }
  };

  const currentAlign = content?.align || '';
  const currentSize = content?.sizeSlug || 'full';
  const imageUrl = content?.kind === 'media' ? content.url : '';
  const storedLinkDestination = content?.linkDestination || 'none';
  const hasDeadAttachmentLink = storedLinkDestination === 'attachment';
  // A blank trigger, not a fake "None", so choosing None actually clears the old attachment link.
  const linkSelectValue = hasDeadAttachmentLink ? '' : storedLinkDestination;

  return (
    <div className="space-y-4">
      <CollapsibleCard
        title="Content"
        icon={ImageIcon}
        defaultOpen={true}
      >
        <div className="space-y-4">
          {/* Image Preview */}
          {imageUrl && (
            <div>
              <SettingsLabel>Preview</SettingsLabel>
              <div className="mt-2 inline-block border border-dashed border-npb-border-strong p-2 rounded-lg" style={{ maxWidth: '100%' }}>
                <img
                  src={imageUrl}
                  alt={content?.alt || ''}
                  style={{ width: '240px', height: 'auto', display: 'block', maxWidth: "100%" }}
                />
              </div>
            </div>
          )}

          <MediaUrlField
            id="image-src"
            label="Image URL"
            value={imageUrl}
            kind="image"
            placeholder="https://example.com/image.jpg"
            onChange={({ url }) =>
              updateContent({ kind: "media", mediaType: "image", url } as ImageContent)
            }
            onLibrarySelect={({ item }) => {
              updateContent({
                kind: "media",
                mediaType: "image",
                id: item.id,
                url: item.url,
                alt: content?.alt || item.alt || item.originalName || item.filename,
                caption: content?.caption,
              } as ImageContent);
            }}
          />

          {/* Alt Text */}
          <div>
            <SettingsLabel htmlFor="image-alt">Alt Text</SettingsLabel>
            <Input
              id="image-alt"
              aria-label="Alt text"
              className="h-9"
              value={content?.alt || ''}
              onChange={(e) => updateContent({ alt: e.target.value } as ImageContent)}
              placeholder="Image description"
            />
          </div>

          {/* Caption */}
          <div>
            <SettingsLabel htmlFor="image-caption">Caption</SettingsLabel>
            <Input
              id="image-caption"
              value={content?.caption || ''}
              onChange={(e) => updateContent({ caption: e.target.value } as ImageContent)}
              placeholder="Image caption (optional)"
            />
          </div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="Figure layout"
        icon={Settings}
        defaultOpen={false}
      >
        <div className="space-y-4">
          {/* Block width in the editor (use Style → Position in container for flex placement) */}
          <div>
            <SettingsLabel>Figure width</SettingsLabel>
            <p className="text-xs text-npb-text-muted mt-1 mb-2">
              How wide the image sits in the layout. This is not text alignment; use{" "}
              <span className="font-semibold">Style → Position in container</span> to nudge the block left, center, or
              right among siblings.
            </p>
            <SettingsChipGroup
              label=""
              ariaLabel="Figure width"
              options={FIGURE_WIDTH_OPTIONS}
              value={currentAlign}
              onChange={(value) => {
                if (isFigureWidth(value)) {
                  updateContent({ align: value });
                }
              }}
            />
          </div>

          <SettingsChipGroup
            label="Image Size"
            ariaLabel="Image Size"
            options={IMAGE_SIZE_OPTIONS}
            value={currentSize}
            onChange={(value) => {
              if (isImageSizeSlug(value)) {
                updateContent({ sizeSlug: value });
              }
            }}
          />

          <p className="text-xs text-npb-text-muted">
            Width, height, max size, and object fit live under the sidebar <span className="font-semibold">Style</span>{" "}
            tab (Layout &amp; Dimensions).
          </p>
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="Link Settings"
        icon={Link}
        defaultOpen={false}
      >
        <div className="space-y-4">
          {/* Link Destination */}
          <div>
            <SettingsLabel htmlFor="image-link-destination-select">Link To</SettingsLabel>
            <Select
              value={linkSelectValue}
              onValueChange={(value) => {
                if (isImageLinkDestination(value)) {
                  updateContent({ linkDestination: value });
                }
              }}
            >
              <SelectTrigger id="image-link-destination-select" aria-label="Link destination">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                <SelectItem value="media">Media file</SelectItem>
                <SelectItem value="custom">Custom URL</SelectItem>
              </SelectContent>
            </Select>
            {hasDeadAttachmentLink ? (
              <p className="text-npb-text-muted text-xs">
                This site has no attachment page. Choose another destination.
              </p>
            ) : null}
          </div>

          {(content?.linkDestination === "custom") && (
            <LinkUrlField
              id="image-link-url"
              label="Custom Link URL"
              value={content?.href || ""}
              onChange={({ url }) => updateContent({ href: url })}
            />
          )}

          <LinkTargetSelect
            id="image-link-target-select"
            value={content?.linkTarget}
            legacyTarget={content?.target}
            onChange={({ target }) => updateContent({ linkTarget: target, target: undefined })}
          />
        </div>
      </CollapsibleCard>
    </div>
  );
}
