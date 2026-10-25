/**
 * Small, pure helpers for the MDX text box: where a line starts, which line and column the cursor
 * is on, and how a block's MDX is put into the text. Kept apart from the box itself so each one
 * can be tested without a browser.
 */

export const countLines = (text: string): number => text.split("\n").length;

/** The index where line `line` (counted from 1) starts; past the last line it is the end of the text. */
export function lineStartIndex({ text, line }: { text: string; line: number }): number {
	if (line <= 1) return 0;
	let index = 0;
	for (let seen = 1; seen < line; seen += 1) {
		const next = text.indexOf("\n", index);
		if (next === -1) return text.length;
		index = next + 1;
	}
	return index;
}

/** The index where line `line` ends, before its line break. */
export function lineEndIndex({ text, line }: { text: string; line: number }): number {
	const start = lineStartIndex({ text, line });
	const next = text.indexOf("\n", start);
	return next === -1 ? text.length : next;
}

/** The line and column (both from 1) of an index in the text. */
export function positionOf({ text, index }: { text: string; index: number }): { line: number; column: number } {
	const before = text.slice(0, Math.max(0, Math.min(index, text.length)));
	const line = countLines(before);
	return { line, column: before.length - (before.lastIndexOf("\n") + 1) + 1 };
}

/**
 * Puts a block's MDX into the text at `index` as its own paragraph: a blank line before and after
 * unless one is already there. Returns the new text and where the cursor goes (just after it).
 */
export function insertSnippet({ text, index, snippet }: { text: string; index: number; snippet: string }): { text: string; cursor: number } {
	const at = Math.max(0, Math.min(index, text.length));
	const before = text.slice(0, at);
	const after = text.slice(at);
	const lead = before === "" || before.endsWith("\n\n") ? "" : before.endsWith("\n") ? "\n" : "\n\n";
	const tail = after === "" ? "\n" : after.startsWith("\n\n") ? "" : after.startsWith("\n") ? "\n" : "\n\n";
	const inserted = `${lead}${snippet}${tail}`;
	return { text: `${before}${inserted}${after}`, cursor: before.length + lead.length + snippet.length + tail.length };
}

/** Two spaces in or out at the start of each line the selection touches (Tab and Shift+Tab). */
export function shiftIndent({ text, start, end, outdent }: { text: string; start: number; end: number; outdent: boolean }): { text: string; start: number; end: number } {
	const first = positionOf({ text, index: start }).line;
	const last = positionOf({ text, index: end }).line;
	const lines = text.split("\n");
	let startShift = 0;
	let endShift = 0;
	for (let line = first; line <= last; line += 1) {
		const current = lines[line - 1];
		const change = outdent ? -Math.min(2, current.length - current.trimStart().length) : 2;
		lines[line - 1] = outdent ? current.slice(-change) : `  ${current}`;
		if (line === first) startShift = change;
		endShift += change;
	}
	return { text: lines.join("\n"), start: Math.max(0, start + startShift), end: Math.max(0, end + endShift) };
}
