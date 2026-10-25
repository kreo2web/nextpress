/** Most lines one range may mark, so a typo like `1-99999` can't build a huge set. */
const MAX_RANGE_LINES = 5000;

/**
 * What a code fence's info line says that the page itself shows, e.g. ```` ```ts {2,4-6} title="app.ts" showLineNumbers ````.
 * The `{2,4-6}` is not read here: Kirari's markdown plugin marks those lines.
 */
export type CodeFenceMeta = {
	title: string | null;
	showLineNumbers: boolean;
	/** `wrap`: long lines wrap instead of scrolling sideways. */
	wrap: boolean;
	/** Long code folds to its first lines unless the fence says `noFold`. */
	fold: boolean;
};

/**
 * Line numbers from a list like `2, 4-6`. Anything that isn't a number or a range is skipped,
 * so a half-typed list still marks the lines it can.
 */
export const parseLineList = (list: string | null | undefined): Set<number> => {
	const lines = new Set<number>();
	for (const part of (list ?? "").split(",")) {
		const match = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part);
		if (!match) continue;
		const first = Number(match[1]);
		const last = match[2] ? Number(match[2]) : first;
		if (first < 1 || last < first || last - first >= MAX_RANGE_LINES) continue;
		for (let line = first; line <= last; line++) lines.add(line);
	}
	return lines;
};

/** Reads a fence's info line. Unknown words are ignored. */
export const parseCodeFenceMeta = (meta: string | null | undefined): CodeFenceMeta => {
	const text = meta ?? "";
	const title = /\b(?:title|filename)=(?:"([^"]*)"|'([^']*)'|(\S+))/.exec(text);
	return {
		title: title ? (title[1] ?? title[2] ?? title[3] ?? null) : null,
		showLineNumbers: /\b(?:showLineNumbers|lineNumbers)\b/.test(text),
		wrap: /\bwrap\b/.test(text),
		fold: !/\bno[Ff]old\b/.test(text),
	};
};
