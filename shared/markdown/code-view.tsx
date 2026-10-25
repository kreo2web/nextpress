import type { JSX, ReactNode } from "react";
import { codeLanguageLabel } from "./code-languages.js";
import { highlightCode } from "./highlight.js";

/** Marks a copy button; the published page's `code.js` and the editor find it by this attribute. */
export const COPY_BUTTON_ATTRIBUTE = "data-np-copy";

/** Code longer than this folds to its first lines (the CSS shows 14) with "Show all" below. */
export const FOLD_AFTER_LINES = 20;

const countLines = (code: string): number => code.replace(/\n$/, "").split("\n").length;

type CodeFrameProps = {
	/** The language's own name (`typescript`), or null when the code shows as plain text. */
	language: string | null;
	/** A file name or caption shown above the code. */
	title?: string | null;
	showLineNumbers?: boolean;
	/** Long lines wrap instead of scrolling sideways. */
	wrapLines?: boolean;
	/** Long code folds to its first lines; a checkbox styled as "Show all" opens it, so it needs no script. */
	fold?: boolean;
	showCopyButton?: boolean;
	/** The code as plain text, handed to `onCopy`. */
	copyText: string;
	/** For places that run React (the AI chat). Published pages copy through `code.js` instead, with the same markup. */
	onCopy?: (code: string) => void;
	className?: string;
	/** The colored code as escaped HTML (Kirari's core, for the code block). */
	html?: string;
	/** The colored code as nodes (Kirari's markdown plugin, for fences). Used when there is no `html`. */
	children?: ReactNode;
};

/**
 * The look of a code block, shared by every way code is shown: header with the title or
 * language and a copy button, then the already colored code. Line numbers and marked lines are
 * CSS (see `markdown-css.ts`). It only draws; the caller brings the colored code.
 */
export function CodeFrame({
	language,
	title,
	showLineNumbers = false,
	wrapLines = false,
	fold = true,
	showCopyButton = true,
	copyText,
	onCopy,
	className,
	html,
	children,
}: CodeFrameProps): JSX.Element {
	const languageLabel = language && language !== "plaintext" ? codeLanguageLabel(language) : null;
	const hasHeader = Boolean(title || languageLabel || showCopyButton);
	const lineCount = countLines(copyText);
	const folds = fold && lineCount > FOLD_AFTER_LINES;

	return (
		<figure
			className={["np-code", className].filter(Boolean).join(" ")}
			data-language={language ?? undefined}
			data-line-numbers={showLineNumbers ? "" : undefined}
			data-wrap={wrapLines ? "" : undefined}
			data-folds={folds ? "" : undefined}>
			{hasHeader ? (
				<figcaption className="np-code-header">
					{title ? <span className="np-code-title">{title}</span> : null}
					{languageLabel ? <span className="np-code-language">{languageLabel}</span> : null}
					{showCopyButton ? (
						<button
							type="button"
							className="np-code-copy"
							aria-label="Copy code"
							{...{ [COPY_BUTTON_ATTRIBUTE]: "" }}
							onClick={onCopy ? () => onCopy(copyText) : undefined}>
							Copy
						</button>
					) : null}
				</figcaption>
			) : null}
			<pre className="kirari np-code-pre" tabIndex={0}>
				{html === undefined ? <code>{children}</code> : <code dangerouslySetInnerHTML={{ __html: html }} />}
			</pre>
			{folds ? (
				<div className="np-code-fold">
					<label className="np-code-fold-button">
						<input type="checkbox" className="np-code-fold-input" />
						<span className="np-code-fold-more">Show all {lineCount} lines</span>
						<span className="np-code-fold-less">Show less</span>
					</label>
				</div>
			) : null}
		</figure>
	);
}

export type CodeViewProps = {
	code: string;
	language?: string | null;
	/** A file name or caption shown above the code. */
	title?: string | null;
	highlightLines?: ReadonlySet<number>;
	showLineNumbers?: boolean;
	/** Long lines wrap instead of scrolling sideways. */
	wrapLines?: boolean;
	showCopyButton?: boolean;
	/** For places that run React (the AI chat). Published pages copy through `code.js` instead, with the same markup. */
	onCopy?: (code: string) => void;
	className?: string;
};

/**
 * The `core/code` block's code, the same in the editor and on the published page (rendered on
 * the server, already colored). It colors with Kirari's core; fenced code in markdown arrives
 * colored from Kirari's markdown plugin and uses `CodeFrame` directly.
 */
export function CodeView({ code, language, title, highlightLines, showLineNumbers, wrapLines, showCopyButton, onCopy, className }: CodeViewProps): JSX.Element {
	const highlighted = highlightCode({ code, language, highlightLines });
	return (
		<CodeFrame
			language={highlighted.language}
			title={title}
			showLineNumbers={showLineNumbers}
			wrapLines={wrapLines}
			showCopyButton={showCopyButton}
			copyText={code}
			onCopy={onCopy}
			className={className}
			html={highlighted.html}
		/>
	);
}
