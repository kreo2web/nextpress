import type { BlockConfig } from "../schema-types.js";
import type { MdxNode } from "../markdown/mdx-tree.js";
import { DIAGRAM_BLOCK_NAME } from "../blocks/diagram-model.js";
import { buildBlock } from "./build-block.js";
import { CORE_BLOCK_NAMES } from "./core-block-names.js";
import type { MapContext } from "./map-types.js";

/** A fence's language: a word such as `ts`, `c++` or `bash`. Anything else (a `title="…"` with no language before it) is not one. */
const LANGUAGE = /^[A-Za-z0-9][A-Za-z0-9+#._-]*$/;

/** The line numbers of a highlight (`2,4-6`): digits, commas, dashes and spaces only. */
const HIGHLIGHT = /^[\d,\s-]*$/;

/** One word of a fence's info line after the language: `{…}`, `title="…"` or `title='…'`, or `showLineNumbers`. */
const META_WORD = /\s*(?:\{([^}]*)\}|title="([^"]*)"|title='([^']*)'|(showLineNumbers))/y;

export type FenceMeta = { highlight: string; title: string; showLineNumbers: boolean };

/**
 * A fence's info line read word by word. Null when it holds any word the blocks can't keep (another
 * option, an unquoted title), so the fence stays as written instead of losing that word.
 */
export const readFenceMeta = (meta: string | null | undefined): FenceMeta | null => {
	const text = (meta ?? "").trim();
	const out: FenceMeta = { highlight: "", title: "", showLineNumbers: false };
	let at = 0;
	while (at < text.length) {
		META_WORD.lastIndex = at;
		const word = META_WORD.exec(text);
		if (!word || word[0].length === 0) return null;
		const [, braces, doubleQuoted, singleQuoted, lineNumbers] = word;
		if (braces !== undefined) {
			if (!HIGHLIGHT.test(braces)) return null;
			out.highlight = braces.split(/[\s,]+/).filter(Boolean).join(",");
		} else if (doubleQuoted !== undefined || singleQuoted !== undefined) {
			out.title = doubleQuoted ?? singleQuoted ?? "";
		} else if (lineNumbers !== undefined) {
			out.showLineNumbers = true;
		}
		at = META_WORD.lastIndex;
	}
	return out;
};

/**
 * A fenced code block as a block: a ```` ```mermaid ```` fence is a diagram (its title is the caption, and it
 * takes no line marks or numbers); any other fence is a code block with its language, title, marked lines and
 * line numbers. Null when the fence holds something the block can't keep.
 */
export const mapCodeNode = ({ ctx, node }: { ctx: MapContext; node: MdxNode }): BlockConfig | null => {
	const meta = readFenceMeta(node.meta);
	const language = node.lang ?? "";
	if (!meta || (language !== "" && !LANGUAGE.test(language))) return null;
	if (language === "mermaid") {
		if (meta.highlight !== "" || meta.showLineNumbers) return null;
		return buildBlock({ name: DIAGRAM_BLOCK_NAME, newId: ctx.newId, fields: { code: node.value ?? "", caption: meta.title } });
	}
	return buildBlock({
		name: CORE_BLOCK_NAMES.code,
		newId: ctx.newId,
		fields: { content: node.value ?? "", language, title: meta.title, highlightLines: meta.highlight, showLineNumbers: meta.showLineNumbers },
	});
};
