import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { Textarea } from "@/components/ui/textarea";
import { SettingsLabel, SettingsSection } from '../../shared';
import { Code2 as HtmlIcon } from 'lucide-react';
import { createBlockDefinition } from "../createBlockDefinition";
import { BlockShell } from "../shared/block-shell";
import { useSettingsState } from "../useSettingsState";
import { sanitizeHtml } from "../../utils";
import { HTML_DEFAULT_CONTENT } from "@shared/block-catalog/text-blocks";
import { catalogMeta } from "../catalog-meta";

// ============================================================================
// TYPES
// ============================================================================

type HtmlContent = {
  content?: string;
  className?: string;
};

const DEFAULT_CONTENT: HtmlContent = HTML_DEFAULT_CONTENT;

// ============================================================================
// RENDERER
// ============================================================================

interface HtmlRendererProps {
  content: HtmlContent;
  styles?: React.CSSProperties;
  isPreview?: boolean;
}

function HtmlRenderer({ content, styles, isPreview }: HtmlRendererProps) {
  const htmlContent = content?.content || '';
  
  if (isPreview && htmlContent) {
    return (
      <BlockShell
        blockClass="wp-block-html"
        className={content?.className}
        style={{ maxWidth: "100%", overflowX: "auto", boxSizing: "border-box", ...styles }}
        dangerouslySetInnerHTML={{ __html: sanitizeHtml(htmlContent) }}
      />
    );
  }

  return (
    <BlockShell blockClass="wp-block-html" className={content?.className} style={styles}>
      <p className="text-xs text-npb-text-muted mb-1">This is the source.</p>
      <div
        className="bg-npb-surface-inset border border-npb-border-default text-npb-text-muted"
        style={{
          padding: '1em',
          borderRadius: '4px',
          fontFamily: 'Monaco, Consolas, "Andale Mono", "DejaVu Sans Mono", monospace',
          fontSize: '14px',
          lineHeight: '1.4',
          whiteSpace: 'pre-wrap',
          overflowX: 'auto',
          maxWidth: '100%',
        }}
      >
        {htmlContent || 'Enter custom HTML...'}
      </div>
    </BlockShell>
  );
}

// ============================================================================
// SETTINGS COMPONENT
// ============================================================================

interface HtmlSettingsProps {
  block: BlockConfig;
  onUpdate?: (updates: Partial<BlockConfig>) => void;
}

function HtmlSettings({ block, onUpdate }: HtmlSettingsProps) {
  const { content, updateContent } = useSettingsState<HtmlContent>({
    block,
    onUpdate,
    defaultContent: DEFAULT_CONTENT,
  });

  return (
    <div className="space-y-4">
      {/* Content Card */}
      <SettingsSection>
        <div className="space-y-4">
          <div>
            <SettingsLabel htmlFor="html-content">Custom HTML</SettingsLabel>
            <Textarea
              id="html-content"
              value={content?.content || ''}
              onChange={(e) => updateContent({ content: e.target.value })}
              placeholder="<p>Enter your custom HTML here...</p>"
              rows={10}
              className="mt-1"
              style={{
                fontFamily: 'Monaco, Consolas, "Andale Mono", "DejaVu Sans Mono", monospace',
                fontSize: '14px',
              }}
            />
            <p className="text-xs text-npb-text-muted mt-2">
              Scripts are removed.
            </p>
          </div>
        </div>
      </SettingsSection>


    </div>
  );
}

// ============================================================================
// BLOCK DEFINITION
// ============================================================================

const HtmlBlock = createBlockDefinition<HtmlContent>({
  ...catalogMeta('core/html'),
  icon: HtmlIcon,
  defaultContent: DEFAULT_CONTENT,
  settings: HtmlSettings,
  hasSettings: true,
  render: ({ content, styles, isPreview }) => (
    <HtmlRenderer content={content} styles={styles} isPreview={isPreview} />
  ),
});

export default HtmlBlock;
