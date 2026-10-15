import React from "react";

/**
 * In-canvas text editor used when a block is in editing mode.
 * Mirrors the surrounding text styling (font, size, weight, color) so the
 * swap from static text to editor is visually seamless. A dashed accent
 * outline marks it as editable without fighting the block's own styles.
 */
type InlineTextEditorProps = {
  value: string;
  onChange: (value: string) => void;
  /** CSS to mirror the rendered text (font-family, size, weight, color...). */
  style?: React.CSSProperties;
  /** Multi-line textarea vs single-line input. */
  multiline?: boolean;
  placeholder?: string;
  /** Min height for multi-line editors (px). */
  minHeight?: number;
  className?: string;
  /**
   * Grow a wrapping field to the text height. Off by default so paragraph and
   * other multiline blocks keep the shared 2-row / 80px field.
   */
  growToWrap?: boolean;
  /** Accessible name for the field (canvas titles, headings, etc.). */
  ariaLabel?: string;
  onFocus?: () => void;
  onBlur?: () => void;
};

function setEditorHeightFromScroll(el: HTMLTextAreaElement): void {
  el.style.height = "0px";
  el.style.height = `${el.scrollHeight}px`;
}

export function InlineTextEditor({
  value,
  onChange,
  style,
  multiline = false,
  placeholder,
  minHeight = 80,
  className,
  growToWrap = false,
  ariaLabel,
  onFocus,
  onBlur,
}: InlineTextEditorProps) {
  const editorStyle: React.CSSProperties = {
    ...style,
    width: "100%",
    background: "transparent",
    border: "1px dashed rgba(59,130,246,0.6)",
    borderRadius: "4px",
    outline: "none",
    margin: 0,
    padding: "4px 6px",
    resize: "none",
    boxSizing: "border-box",
  };

  if (growToWrap) {
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <textarea
          value={value}
          onChange={(e) => {
            setEditorHeightFromScroll(e.currentTarget);
            onChange(e.target.value);
          }}
          onFocus={onFocus}
          onBlur={onBlur}
          ref={(el) => {
            if (el) setEditorHeightFromScroll(el);
          }}
          placeholder={placeholder}
          aria-label={ariaLabel}
          rows={1}
          style={{
            ...editorStyle,
            whiteSpace: "pre-wrap",
            overflow: "hidden",
          }}
          className={className}
        />
      </div>
    );
  }

  if (multiline) {
    const lineCount = value.split("\n").length;
    return (
      <div onClick={(e) => e.stopPropagation()}>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          aria-label={ariaLabel}
          rows={Math.max(2, Math.min(12, lineCount + 1))}
          style={{ ...editorStyle, minHeight }}
          className={className}
        />
      </div>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        placeholder={placeholder}
        aria-label={ariaLabel}
        style={{ ...editorStyle, minHeight: 28, height: "auto" }}
        className={className}
      />
    </div>
  );
}
