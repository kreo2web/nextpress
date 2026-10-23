/** Where the scanner is between lines: inside a component tag (which may span lines), and in a quote or `{…}` there. */
type ScanState = { inTag: boolean; quote: string | null; braceDepth: number };

const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})\s*$/;
const TAG_START = /[A-Za-z/>]/;

/** One character inside a `<Component …>` tag: tracks quotes and attribute `{…}` so the tag's end is found. */
const scanTagChar = ({ char, state }: { char: string; state: ScanState }): void => {
	if (state.quote) {
		if (char === state.quote) state.quote = null;
	} else if (char === '"' || char === "'") state.quote = char;
	else if (char === "{") state.braceDepth++;
	else if (char === "}" && state.braceDepth > 0) state.braceDepth--;
	else if (char === ">" && state.braceDepth === 0) state.inTag = false;
};

/** Escapes `{` and `}` in one line of prose, leaving inline code, existing escapes and component tags as written. */
const escapeLine = ({ line, state }: { line: string; state: ScanState }): string => {
	let out = "";
	for (let index = 0; index < line.length; index++) {
		const char = line[index];
		if (state.inTag) {
			scanTagChar({ char, state });
			out += char;
		} else if (char === "\\") {
			out += line.slice(index, index + 2);
			index++;
		} else if (char === "`") {
			const run = /^`+/.exec(line.slice(index))?.[0] ?? "`";
			const close = line.indexOf(run, index + run.length);
			const end = close === -1 ? index + run.length : close + run.length;
			out += line.slice(index, end);
			index = end - 1;
		} else if (char === "<" && TAG_START.test(line[index + 1] ?? "")) {
			state.inTag = true;
			out += char;
		} else {
			out += char === "{" || char === "}" ? `\\${char}` : char;
		}
	}
	return out;
};

/**
 * MDX text with every brace in prose escaped, so `{` and `}` always show as written.
 *
 * WHY: MDX reads `{…}` as JavaScript and refuses the whole document when it isn't valid code, so
 * "Set {name} here" would break a page. NextPress never runs MDX, so a brace in text is only ever
 * text. Code fences, inline code and component tags (whose props may use braces) are left alone.
 */
export const escapeMdxBraces = (text: string): string => {
	const state: ScanState = { inTag: false, quote: null, braceDepth: 0 };
	let fence: string | null = null;
	return text
		.split("\n")
		.map((line) => {
			const opening = FENCE.exec(line)?.[1];
			if (fence) {
				const closing = FENCE_CLOSE.exec(line)?.[1];
				if (closing && closing[0] === fence[0] && closing.length >= fence.length) fence = null;
				return line;
			}
			if (opening && !state.inTag) {
				fence = opening;
				return line;
			}
			return escapeLine({ line, state });
		})
		.join("\n");
};
