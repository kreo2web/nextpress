import React from "react";
import type { JSX } from "react";
import { FileText as MarkdownIcon } from "lucide-react";
import MDEditor from "@uiw/react-md-editor";
import { useTheme } from "@/components/ThemeProvider";
import { createBlockDefinition } from "../createBlockDefinition";
import { BlockShell } from "../shared/block-shell";
import { MARKDOWN_DEFAULT_CONTENT } from "@shared/block-catalog/text-blocks";
import { catalogMeta } from "../catalog-meta";

// ============================================================================
// TYPES
// ============================================================================

export type MarkdownContent = {
  content?: string;
  className?: string;
};

const DEFAULT_CONTENT: MarkdownContent = MARKDOWN_DEFAULT_CONTENT;

const MIN_EDITOR_HEIGHT_PX = 160;
const LINE_HEIGHT_PX = 28;
const TOOLBAR_HEIGHT_PX = 48;
const FALLBACK_MAX_HEIGHT_PX = 560;

function readEditorColorMode(isDark: boolean | undefined): "light" | "dark" {
  return isDark === true ? "dark" : "light";
}

/**
 * Grow with line count, stay at least 160px, cap at 70vh (560px when viewport height is unknown).
 */
function getMarkdownEditorHeight(markdownText: string): number {
  const lineCount = Math.max(1, markdownText.split("\n").length);
  const contentHeight = lineCount * LINE_HEIGHT_PX + TOOLBAR_HEIGHT_PX;
  const viewportHeight = typeof window === "undefined" ? 0 : window.innerHeight;
  const maxHeight =
    viewportHeight > 0 ? Math.round(viewportHeight * 0.7) : FALLBACK_MAX_HEIGHT_PX;
  return Math.max(MIN_EDITOR_HEIGHT_PX, Math.min(maxHeight, contentHeight));
}

// ============================================================================
// RENDERER
// ============================================================================

interface MarkdownRendererProps {
  content: MarkdownContent;
  styles?: React.CSSProperties;
  isPreview?: boolean;
  onChange?: (value: string) => void;
}

function MarkdownRenderer({
  content,
  styles,
  isPreview,
  onChange,
}: MarkdownRendererProps): JSX.Element {
  const markdownText = content?.content || "";
  const theme = useTheme();
  const colorMode = readEditorColorMode(theme?.isDark);

  if (isPreview) {
    return (
      <BlockShell blockClass="wp-block-markdown" className={content?.className} style={styles} data-color-mode={colorMode}>
        <MDEditor.Markdown source={markdownText} style={{ whiteSpace: "pre-wrap" }} />
      </BlockShell>
    );
  }

  return (
    <BlockShell blockClass="wp-block-markdown" className={content?.className} style={styles} data-color-mode={colorMode}>
      <div className="min-h-[160px] max-h-[70vh] overflow-y-auto rounded-md border border-npb-border-default bg-npb-surface-base transition-colors hover:border-npb-border-strong focus-within:ring-2 focus-within:ring-npb-focus focus-within:ring-offset-1">
        <MDEditor
          value={markdownText}
          onChange={(val) => onChange?.(val || "")}
          preview="live"
          height={getMarkdownEditorHeight(markdownText)}
          hideToolbar={false}
          visiableDragbar={true}
        />
      </div>
    </BlockShell>
  );
}

// ============================================================================
// BLOCK DEFINITION
// ============================================================================

const MarkdownBlock = createBlockDefinition<MarkdownContent>({
  ...catalogMeta("core/markdown"),
  icon: MarkdownIcon,
  defaultContent: DEFAULT_CONTENT,
  hasSettings: false,
  render: ({ content, styles, setContent, isPreview }) => (
    <MarkdownRenderer
      content={content}
      styles={styles}
      isPreview={isPreview}
      onChange={(val) => setContent({ ...content, content: val })}
    />
  ),
});

export default MarkdownBlock;
