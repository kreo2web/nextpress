import type { JSX } from "react";
import { codeLanguageLabel } from "./code-languages.js";
import { highlightCode } from "./highlight.js";

/** Marks a copy button; the published page's `code.js` and the editor find it by this attribute. */
export const COPY_BUTTON_ATTRIBUTE = "data-np-copy";

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
 * One code block, the same everywhere: editor, published page (rendered on the server, already
 * colored) and chat. Header with the title or language and a copy button, then the colored code.
 * Line numbers and marked lines are CSS (see `markdown-css.ts`).
 */
export function CodeView({
	code,
	language,
	title,
	highlightLines,
	showLineNumbers = false,
	wrapLines = false,
	showCopyButton = true,
	onCopy,
	className,
}: CodeViewProps): JSX.Element {
	const highlighted = highlightCode({ code, language, highlightLines });
	const languageLabel = highlighted.language && highlighted.language !== "plaintext" ? codeLanguageLabel(highlighted.language) : null;
	const hasHeader = Boolean(title || languageLabel || showCopyButton);

	return (
		<figure
			className={["np-code", className].filter(Boolean).join(" ")}
			data-language={highlighted.language ?? undefined}
			data-line-numbers={showLineNumbers ? "" : undefined}
			data-wrap={wrapLines ? "" : undefined}>
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
							onClick={onCopy ? () => onCopy(code) : undefined}>
							Copy
						</button>
					) : null}
				</figcaption>
			) : null}
			<pre className="kirari np-code-pre" tabIndex={0}>
				<code dangerouslySetInnerHTML={{ __html: highlighted.html }} />
			</pre>
		</figure>
	);
}
