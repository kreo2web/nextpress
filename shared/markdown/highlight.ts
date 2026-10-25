import { tokenize } from "@vortexlabs/kirari/core";
import { renderDecorated } from "@vortexlabs/kirari/decorations";
import { getCodeLanguage, resolveCodeLanguage } from "./code-languages.js";
import { KIRARI_RENDER_OPTIONS, MARKED_LINE_CLASS } from "./kirari-options.js";

export type HighlightedCode = {
	/** Escaped HTML: one `.kirari-line` span per line, tokens as `.kirari-*` spans. Safe to set as inner HTML. */
	html: string;
	/** The language's own name, or null when the code shows as plain text. */
	language: string | null;
};

/**
 * Colors the `core/code` block's code with Kirari's core, on the server and in the editor. It is
 * not markdown, so it has no plugin to run in; fences are colored by Kirari's markdown plugin
 * instead (see `rehype-plugins.ts`). Both read `kirari-options.ts`, so the same code gives the
 * same spans either way. An unknown language still shows its code, as plain text in the same lines.
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
		...KIRARI_RENDER_OPTIONS,
		lineClassName: ({ number }) => (marked.has(number) ? MARKED_LINE_CLASS : undefined),
	});
	return { html, language: resolved };
};
