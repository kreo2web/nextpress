import type { BlockConfig } from "@shared/schema-types";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { Image as ImageIcon, Settings, Link } from "lucide-react";
import { useSettingsState } from "../useSettingsState";
import { SettingsLabel } from '../../shared';
import { SettingsDisclosure } from "../../shared/settings-disclosure";
import { MediaUrlField } from "../shared/media-url-field";
import { LinkUrlField, LinkTargetSelect } from "../shared/link-settings";
import { SettingsChipGroup } from "../../settings-chip-group";
import { sanitizeHtml } from "../../utils";
import { type MediaTextData } from './media-text-model';
import { MEDIA_TEXT_DEFAULT_DATA as DEFAULT_DATA } from '@shared/block-catalog/media-blocks';

type MediaTextSettingsProps = {
  block: BlockConfig;
  onUpdate?: (updates: Partial<BlockConfig>) => void;
};

const SIDE_OPTIONS = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

const VERTICAL_ALIGN_OPTIONS = [
  { value: "top", label: "Top" },
  { value: "center", label: "Center" },
  { value: "bottom", label: "Bottom" },
];

function isMediaPosition(value: string): value is NonNullable<MediaTextData["mediaPosition"]> {
  return value === "left" || value === "right";
}

function isVerticalAlignment(
  value: string,
): value is NonNullable<MediaTextData["verticalAlignment"]> {
  return value === "top" || value === "center" || value === "bottom";
}

/**
 * WHY: Media-text stores HTML in `content`, but most values are simple paragraphs.
 * Extra tags (strong, a, headings) mean the saved markup is intentional —
 * keep the raw HTML so those tags are not stripped by a plain-text save.
 */
function hasMediaTextFormatting(html: string): boolean {
  const withoutAllowed = html
    .replace(/<\/?p\b[^>]*>/gi, "")
    .replace(/<br\s*\/?>/gi, "");
  return /<\/?[a-z][^>]*>/i.test(withoutAllowed);
}

function mediaTextParagraphToLine(inner: string): string {
  const withoutBreaks = inner.replace(/<br\s*\/?>/gi, "");
  return withoutBreaks.trim() === "" ? "" : inner;
}

function readMediaTextPlainText(html: string): string {
  if (html && /<p/i.test(html)) {
    return html
      .split(/<\/p>/i)
      .filter((chunk) => /<p/i.test(chunk))
      .map((chunk) => mediaTextParagraphToLine(chunk.replace(/<p[^>]*>/i, "")))
      .join("\n");
  }
  const withoutBreaks = html.replace(/<br\s*\/?>/gi, "");
  return withoutBreaks.trim() === "" ? "" : html;
}

/**
 * WHY: A single styled `<p>` should keep its opening tag on the first edit
 * so a pasted look does not collapse to a bare paragraph.
 */
function readSinglePOpeningTag(html: string): string | undefined {
  const matches = html.match(/<p\b[^>]*>/gi);
  if (!matches || matches.length !== 1) return undefined;
  const tag = matches[0];
  return /<p\s+\S/i.test(tag) ? tag : undefined;
}

function writeMediaTextHtml({
  text,
  openingTag,
}: {
  text: string;
  openingTag?: string;
}): string {
  const open = openingTag ?? "<p>";
  return text
    .split("\n")
    .map((line) => (line === "" ? `${open}<br></p>` : `${open}${sanitizeHtml(line)}</p>`))
    .join("");
}

export function MediaTextSettings({ block, onUpdate }: MediaTextSettingsProps) {
  const { content: blockData, updateContent } = useSettingsState<MediaTextData>({
    block,
    onUpdate,
    defaultContent: DEFAULT_DATA,
  });

  const textHtml = blockData?.content || "";
  const textHasFormatting = hasMediaTextFormatting(textHtml);
  const textOpeningTag = textHasFormatting ? undefined : readSinglePOpeningTag(textHtml);

  return (
    <div className="space-y-4">
      <CollapsibleCard title="Content" icon={ImageIcon} defaultOpen={true}>
        <div className="space-y-4">
          <MediaUrlField
            id="media-url"
            label="Media URL"
            value={blockData?.mediaUrl || ""}
            kind="any"
            libraryButtonLabel="Choose"
            placeholder="https://example.com/image-or-video.jpg"
            onChange={({ url }) => updateContent({ mediaUrl: url })}
            onLibrarySelect={({ item }) => {
              const type = item.mimeType?.startsWith("video/") ? "video" : "image";
              updateContent({
                mediaId: item.id ? Number(item.id) : undefined,
                mediaUrl: item.url,
                mediaType: type,
                mediaAlt: blockData?.mediaAlt || item.alt || item.originalName || item.filename,
              });
            }}
          />
          <div>
            <SettingsLabel htmlFor="media-alt">Alt Text</SettingsLabel>
            <Input
              id="media-alt"
              value={blockData?.mediaAlt || ''}
              onChange={(e) => updateContent({ mediaAlt: e.target.value })}
              placeholder="Describe the media"
              className="mt-1 h-9"
            />
          </div>
          <div>
            <SettingsLabel htmlFor="text-content">Text</SettingsLabel>
            {textHasFormatting ? (
              <>
                <Textarea
                  id="text-content"
                  value={textHtml}
                  onChange={(e) => updateContent({ content: e.target.value })}
                  placeholder="Add your content…"
                  rows={4}
                  className="mt-1"
                  aria-label="Text"
                />
                <p className="npb-settings-hint-muted text-xs">
                  This text has formatting. Editing here keeps the tags.
                </p>
              </>
            ) : (
              <Textarea
                id="text-content"
                value={readMediaTextPlainText(textHtml)}
                onChange={(e) =>
                  updateContent({
                    content: writeMediaTextHtml({
                      text: e.target.value,
                      openingTag: textOpeningTag,
                    }),
                  })
                }
                placeholder="Add your content…"
                rows={4}
                className="mt-1"
                aria-label="Text"
              />
            )}
          </div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Layout" icon={Settings} defaultOpen={false}>
        <div className="space-y-4">
          <SettingsChipGroup
            label="Side"
            options={SIDE_OPTIONS}
            value={blockData?.mediaPosition || "left"}
            onChange={(value) => {
              if (isMediaPosition(value)) {
                updateContent({ mediaPosition: value });
              }
            }}
          />

          <div>
            <SettingsLabel htmlFor="media-width">Media Width (%)</SettingsLabel>
            <Input
              id="media-width"
              type="number"
              min={0}
              max={100}
              value={blockData?.mediaWidth ?? 50}
              onChange={(e) => updateContent({ mediaWidth: Number(e.target.value) })}
              className="h-9 mt-1"
            />
          </div>

          <div className="flex items-center justify-between">
            <SettingsLabel htmlFor="stacked-mobile">Stack on mobile</SettingsLabel>
            <Switch
              id="stacked-mobile"
              checked={Boolean(blockData?.isStackedOnMobile)}
              onCheckedChange={(checked) => updateContent({ isStackedOnMobile: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <SettingsLabel htmlFor="image-fill">Crop to fill</SettingsLabel>
            <Switch
              id="image-fill"
              checked={Boolean(blockData?.imageFill)}
              onCheckedChange={(checked) => updateContent({ imageFill: checked })}
            />
          </div>

          <SettingsChipGroup
            label="Vertical alignment"
            options={VERTICAL_ALIGN_OPTIONS}
            value={blockData?.verticalAlignment || "center"}
            onChange={(value) => {
              if (isVerticalAlignment(value)) {
                updateContent({ verticalAlignment: value });
              }
            }}
          />
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Link Settings" icon={Link} defaultOpen={false}>
        <div className="space-y-4">
          <LinkUrlField
            id="media-link"
            label="Media Link"
            value={blockData?.href || ""}
            onChange={({ url }) => updateContent({ href: url })}
          />

          <LinkTargetSelect
            id="media-target"
            label="Link Target"
            value={blockData?.linkTarget}
            onChange={({ target }) => updateContent({ linkTarget: target })}
          />

          <SettingsDisclosure title="Rel" defaultOpen={Boolean(blockData?.rel)}>
            <SettingsLabel htmlFor="media-rel">Rel</SettingsLabel>
            <Input
              id="media-rel"
              value={blockData?.rel || ''}
              onChange={(e) => updateContent({ rel: e.target.value })}
              placeholder="noopener noreferrer"
              className="h-9 mt-1"
            />
          </SettingsDisclosure>

          <div>
            <SettingsLabel htmlFor="media-title">Title</SettingsLabel>
            <Input
              id="media-title"
              value={blockData?.title || ''}
              onChange={(e) => updateContent({ title: e.target.value })}
              placeholder="Media title"
              className="mt-1 h-9"
            />
          </div>
        </div>
      </CollapsibleCard>
    </div>
  );
}
