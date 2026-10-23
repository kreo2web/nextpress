import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { CODE_LANGUAGE_OPTIONS, CodeView, parseLineList, resolveCodeLanguage } from "@shared/markdown";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CollapsibleCard } from "@/components/ui/collapsible-card";
import { SettingsLabel } from "../../shared";
import { Code as CodeIcon } from "lucide-react";
import { createBlockDefinition } from "../createBlockDefinition";
import { BlockShell } from "../shared/block-shell";
import { useSettingsState } from "../useSettingsState";
import { CODE_DEFAULT_CONTENT } from "@shared/block-catalog/text-blocks";
import { catalogMeta } from "../catalog-meta";

// ============================================================================
// TYPES
// ============================================================================

export type CodeContent = {
  content?: string;
  language?: string;
  /** A file name or caption shown above the code. */
  title?: string;
  /** Lines to mark, e.g. "2, 4-6". */
  highlightLines?: string;
  className?: string;
  showLineNumbers?: boolean;
  wrapLines?: boolean;
  showCopyButton?: boolean;
};

const DEFAULT_CONTENT: CodeContent = CODE_DEFAULT_CONTENT;

/** The picker's value: older blocks may say `bash` or `js`; the picker lists each language once. */
const pickerLanguage = (language: string | undefined): string => resolveCodeLanguage(language) ?? "plaintext";

const copyToClipboard = (code: string): void => {
  void navigator.clipboard?.writeText(code).catch((error: unknown) =>
    console.error({ atFunction: "CodeBlock.copy", data: { error }, message: "The browser refused to copy the code" }),
  );
};

// ============================================================================
// RENDERER & IN-CANVAS EDITOR
// ============================================================================

interface CodeRendererProps {
  content: CodeContent;
  styles?: React.CSSProperties;
  isEditing?: boolean;
  onUpdateContent?: (updates: Partial<CodeContent>) => void;
}

/** Two spaces on Tab instead of leaving the field. */
const indentOnTab = ({
  event,
  onUpdateContent,
}: {
  event: React.KeyboardEvent<HTMLTextAreaElement>;
  onUpdateContent?: (updates: Partial<CodeContent>) => void;
}): void => {
  if (event.key !== "Tab") return;
  event.preventDefault();
  const target = event.currentTarget;
  const { selectionStart: start, selectionEnd: end, value } = target;
  onUpdateContent?.({ content: `${value.substring(0, start)}  ${value.substring(end)}` });
  setTimeout(() => {
    target.selectionStart = target.selectionEnd = start + 2;
  }, 0);
};

/**
 * Outside editing, the shared code view, exactly as the published page shows it (colored, title,
 * marked lines). While editing, a plain field for the code.
 */
function CodeRenderer({ content, styles, isEditing, onUpdateContent }: CodeRendererProps) {
  const codeContent = content?.content ?? "";
  const wrapLines = content?.wrapLines !== false;
  const lineCount = codeContent.split("\n").length;

  if (!isEditing) {
    return (
      <BlockShell blockClass="wp-block-code" className={content?.className || undefined} style={styles}>
        <CodeView
          code={codeContent}
          language={content?.language}
          title={content?.title}
          highlightLines={parseLineList(content?.highlightLines)}
          showLineNumbers={Boolean(content?.showLineNumbers)}
          wrapLines={wrapLines}
          showCopyButton={Boolean(content?.showCopyButton)}
          onCopy={copyToClipboard}
        />
      </BlockShell>
    );
  }

  return (
    <BlockShell blockClass="wp-block-code" className={content?.className || undefined} style={styles}>
      <div className="rounded-lg bg-slate-900 p-3 text-slate-100" onClick={(event) => event.stopPropagation()}>
        <div className="mb-2 flex items-center justify-between border-b border-slate-700 pb-2 text-[11px] text-slate-400">
          <span className="font-mono font-semibold uppercase tracking-wider text-slate-300">{pickerLanguage(content?.language)}</span>
          <span>
            {lineCount} {lineCount === 1 ? "line" : "lines"}
          </span>
        </div>
        <textarea
          value={codeContent}
          onChange={(event) => onUpdateContent?.({ content: event.target.value })}
          onKeyDown={(event) => indentOnTab({ event, onUpdateContent })}
          placeholder="Paste or write your code here..."
          rows={Math.max(4, Math.min(20, lineCount + 1))}
          aria-label="Code"
          className="w-full resize-y rounded border border-slate-700 bg-slate-900/90 p-2 font-mono text-xs leading-relaxed text-slate-100 focus:outline-none focus:ring-1 focus:ring-primary"
          style={{ tabSize: 2, whiteSpace: wrapLines ? "pre-wrap" : "pre" }}
          autoFocus
        />
        <p className="mt-1 text-[11px] text-slate-400">
          Tip: Press <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5">Tab</kbd> to indent with 2 spaces. Press{" "}
          <kbd className="rounded border border-slate-700 bg-slate-800 px-1 py-0.5">Esc</kbd> when finished.
        </p>
      </div>
    </BlockShell>
  );
}

// ============================================================================
// SETTINGS COMPONENT
// ============================================================================

interface CodeSettingsProps {
  block: BlockConfig;
  onUpdate?: (updates: Partial<BlockConfig>) => void;
}

function CodeSettings({ block, onUpdate }: CodeSettingsProps) {
  const { content, updateContent } = useSettingsState<CodeContent>({
    block,
    onUpdate,
    defaultContent: DEFAULT_CONTENT,
  });

  return (
    <div className="space-y-4">
      <CollapsibleCard title="Code" icon={CodeIcon} defaultOpen={true}>
        <div className="space-y-4">
          <div>
            <SettingsLabel htmlFor="code-language">Language</SettingsLabel>
            <Select value={pickerLanguage(content?.language)} onValueChange={(val) => updateContent({ language: val })}>
              <SelectTrigger id="code-language" className="mt-1 h-9">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {CODE_LANGUAGE_OPTIONS.map((lang) => (
                  <SelectItem key={lang.value} value={lang.value} className="text-xs">
                    {lang.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <SettingsLabel htmlFor="code-title">File name or caption</SettingsLabel>
            <Input
              id="code-title"
              value={content?.title ?? ""}
              onChange={(event) => updateContent({ title: event.target.value })}
              placeholder="src/app.ts"
              className="mt-1 h-9 text-xs font-mono"
            />
          </div>

          <div>
            <SettingsLabel htmlFor="code-content-field">Code</SettingsLabel>
            <Textarea
              id="code-content-field"
              value={content?.content || ""}
              onChange={(event) => updateContent({ content: event.target.value })}
              placeholder="Enter your code here..."
              rows={8}
              className="mt-1 text-xs font-mono"
            />
          </div>
        </div>
      </CollapsibleCard>

      <CollapsibleCard title="Display" defaultOpen={false}>
        <div className="space-y-3">
          <div>
            <SettingsLabel htmlFor="code-highlight-lines">Mark lines</SettingsLabel>
            <Input
              id="code-highlight-lines"
              value={content?.highlightLines ?? ""}
              onChange={(event) => updateContent({ highlightLines: event.target.value })}
              placeholder="2, 4-6"
              aria-describedby="code-highlight-lines-hint"
              className="mt-1 h-9 text-xs font-mono"
            />
            <p id="code-highlight-lines-hint" className="mt-1 text-xs text-npb-text-muted">
              Line numbers or ranges to point readers at.
            </p>
          </div>

          <div className="flex items-center justify-between">
            <SettingsLabel htmlFor="code-linenumbers">Show line numbers</SettingsLabel>
            <Switch
              id="code-linenumbers"
              checked={Boolean(content?.showLineNumbers)}
              onCheckedChange={(checked) => updateContent({ showLineNumbers: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <SettingsLabel htmlFor="code-copybutton">Show copy button</SettingsLabel>
            <Switch
              id="code-copybutton"
              checked={Boolean(content?.showCopyButton)}
              onCheckedChange={(checked) => updateContent({ showCopyButton: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <SettingsLabel htmlFor="code-wraplines">Wrap long lines</SettingsLabel>
            <Switch
              id="code-wraplines"
              checked={content?.wrapLines !== false}
              onCheckedChange={(checked) => updateContent({ wrapLines: checked })}
            />
          </div>
        </div>
      </CollapsibleCard>
    </div>
  );
}

// ============================================================================
// BLOCK DEFINITION
// ============================================================================

const CodeBlock = createBlockDefinition<CodeContent>({
  ...catalogMeta("core/code"),
  icon: CodeIcon,
  defaultContent: DEFAULT_CONTENT,
  settings: CodeSettings,
  hasSettings: true,
  render: ({ content, styles, isEditing, setContent }) => (
    <CodeRenderer
      content={content}
      styles={styles}
      isEditing={isEditing}
      onUpdateContent={(updates) => setContent((prev) => ({ ...prev, ...updates }))}
    />
  ),
});

export default CodeBlock;
