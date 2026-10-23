import { tokenize } from "@vortexlabs/kirari/core";
import { renderDecorated } from "@vortexlabs/kirari/decorations";
import { getCodeLanguage, resolveCodeLanguage } from "./code-languages.js";

/** CSS class on a line the author marked, e.g. with `{2,4-6}` on the fence. */
export const MARKED_LINE_CLASS = "np-code-line-marked";

export type HighlightedCode = {
	/** Escaped HTML: one `.kirari-line` span per line, tokens as `.kirari-*` spans. Safe to set as inner HTML. */
	html: string;
	/** The language's own name, or null when the code shows as plain text. */
	language: string | null;
};

/**
 * Colors code for every place NextPress shows it: the editor, published pages (on the server,
 * so the HTML arrives colored) and the AI chat. The one place that knows the highlighter.
 *
 * WHY one adapter: Kirari is young; if it ever has to go, only this file changes. Every line is
 * wrapped so line numbers and marked lines are plain CSS, and an unknown language still shows
 * its code as plain text in the same structure.
 */
export const highlightCode = ({
	code,
	language,
	highlightLines,
}: {
	code: string;
	language: string | null | undefined;
	highlightLines?: ReadonlySet<number>;
}): HighlightedCode => {
	const resolved = resolveCodeLanguage(language);
	const marked = highlightLines ?? new Set<number>();
	const html = renderDecorated(tokenize(code, getCodeLanguage(resolved)), {
		lines: true,
		lineClassName: ({ number }) => (marked.has(number) ? MARKED_LINE_CLASS : undefined),
	});
	return { html, language: resolved };
};
