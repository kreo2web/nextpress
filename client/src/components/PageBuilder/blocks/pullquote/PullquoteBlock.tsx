import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { SettingsLabel, SettingsSection } from '../../shared';
import { Quote as QuoteIcon } from "lucide-react";
import { createBlockDefinition } from "../createBlockDefinition";
import { BlockShell } from "../shared/block-shell";
import { InlineTextEditor } from "../shared/inline-text-editor";
import { useSettingsState } from "../useSettingsState";
import { readTextAlign } from "@shared/text-align";
import { sanitizeHtml } from "../../utils";

// ============================================================================
// TYPES
// ============================================================================

type PullquoteContent = {
  value?: string;
  citation?: string;
  textAlign?: 'left' | 'center' | 'right';
  className?: string;
};

function quotePlainText(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
}

function quoteHtmlFromPlain(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<p>${escaped}</p>`;
}

const DEFAULT_CONTENT: PullquoteContent = {
  value: '<p>Add a quote that stands out from the rest of your content.</p>',
  citation: '',
  className: '',
};

// ============================================================================
// RENDERER
// ============================================================================

interface PullquoteRendererProps {
  content: PullquoteContent;
  styles?: React.CSSProperties;
  isEditing?: boolean;
  onUpdateContent?: (updates: Partial<PullquoteContent>) => void;
}

function PullquoteRenderer({
  content,
  styles,
  isEditing,
  onUpdateContent,
}: PullquoteRendererProps) {
  const value = content?.value || '';
  const citation = content?.citation || '';
  const textAlign = readTextAlign({ styles, content }) ?? "center";
  
  return (
    <BlockShell
      as="figure"
      blockClass="wp-block-pullquote"
      className={[
        textAlign ? `has-text-align-${textAlign}` : '',
        content?.className || '',
      ].filter(Boolean).join(' ') || undefined}
      style={{
        textAlign,
        margin: '2em 0',
        padding: '2em',
        borderTop: '4px solid currentColor',
        borderBottom: '4px solid currentColor',
        backgroundColor: '#f8f9fa',
        overflowWrap: 'break-word',
        ...styles,
      }}
    >
      {isEditing ? (
        <div className="space-y-2">
          <blockquote
            style={{
              fontSize: '1.5em',
              lineHeight: '1.6',
              fontStyle: 'italic',
              margin: 0,
              padding: 0,
            }}
          >
            <InlineTextEditor
              value={quotePlainText(value)}
              onChange={(text) => onUpdateContent?.({ value: quoteHtmlFromPlain(text) })}
              style={{ fontSize: '1.5em', lineHeight: '1.6', fontStyle: 'italic', color: 'inherit' }}
              multiline
              placeholder="Enter your quote here..."
            />
          </blockquote>
          <InlineTextEditor
            value={citation}
            onChange={(text) => onUpdateContent?.({ citation: text })}
            style={{ fontSize: '0.9em', fontStyle: 'normal', opacity: 0.8 }}
            placeholder="Quote author or source"
          />
        </div>
      ) : (
        <>
          <blockquote
            style={{
              fontSize: '1.5em',
              lineHeight: '1.6',
              fontStyle: 'italic',
              margin: 0,
              padding: 0,
            }}
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(value) }}
          />
          {citation && (
            <cite
              style={{
                display: 'block',
                marginTop: '1em',
                fontSize: '0.9em',
                fontStyle: 'normal',
                opacity: 0.8,
              }}
            >
              {citation}
            </cite>
          )}
        </>
      )}
    </BlockShell>
  );
}

// ============================================================================
// SETTINGS COMPONENT
// ============================================================================

interface PullquoteSettingsProps {
  block: BlockConfig;
  onUpdate?: (updates: Partial<BlockConfig>) => void;
}

function PullquoteSettings({ block, onUpdate }: PullquoteSettingsProps) {
  const { content, updateContent } = useSettingsState<PullquoteContent>({
    block,
    onUpdate,
    defaultContent: DEFAULT_CONTENT,
  });

  return (
    <SettingsSection>
      <div>
        <SettingsLabel htmlFor="pullquote-content">Quote</SettingsLabel>
        <Textarea
          id="pullquote-content"
          value={quotePlainText(content?.value || '')}
          onChange={(e) => updateContent({ value: quoteHtmlFromPlain(e.target.value) })}
          placeholder="Enter your quote here..."
          rows={4}
          className="mt-1"
        />
      </div>
      <div>
        <SettingsLabel htmlFor="pullquote-citation">Citation</SettingsLabel>
        <Input
          id="pullquote-citation"
          value={content?.citation || ''}
          onChange={(e) => updateContent({ citation: e.target.value })}
          placeholder="Quote author or source"
          className="mt-1 h-9"
        />
      </div>
    </SettingsSection>
  );
}

// ============================================================================
// BLOCK DEFINITION
// ============================================================================

const PullquoteBlock = createBlockDefinition<PullquoteContent>({
  id: 'core/pullquote',
  label: 'Pullquote',
  icon: QuoteIcon,
  description: 'Give special visual emphasis to a quote from your text',
  category: 'advanced',
  defaultContent: DEFAULT_CONTENT,
  defaultStyles: {
    backgroundColor: '#f8f9fa',
    color: '#000000',
    textAlign: 'center',
  },
  settings: PullquoteSettings,
  hasSettings: true,
  render: ({ content, styles, isEditing, setContent }) => (
    <PullquoteRenderer
      content={content}
      styles={styles}
      isEditing={isEditing}
      onUpdateContent={(updates) => setContent((prev) => ({ ...prev, ...updates }))}
    />
  ),
});

export default PullquoteBlock;
