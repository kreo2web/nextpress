import rehypeKirari from "@vortexlabs/kirari-rehype";
import { defaultRehypePlugins } from "streamdown";
import type { Plugin, Pluggable } from "unified";
import { resolveCodeLanguage } from "./code-languages.js";
import { KIRARI_REHYPE_OPTIONS } from "./kirari-options.js";

/** The parts of the page's HTML tree (hast) these steps read or write. */
type HastNode = {
	type: string;
	tagName?: string;
	value?: string;
	properties?: { className?: string[]; metastring?: string };
	data?: { meta?: string };
	children?: HastNode[];
};

/** What the HTML cleaning step's settings list: the tags it keeps and the attributes each may have. */
type SanitizeSchema = {
	tagNames?: string[];
	attributes?: Record<string, Array<string | [string, ...Array<string | number | boolean | RegExp>]>>;
};

const LANGUAGE_CLASS = /(?:^|\s)language-(\S+)/;

/**
 * The language the author typed after a fence (`bash` in ```` ```bash ````), read from the code's
 * class names. The first one wins: the fallback `rehypePrepareFences` adds always comes last.
 */
export const readFenceLanguage = (className: string | readonly string[] | undefined): string | null =>
	LANGUAGE_CLASS.exec(typeof className === "string" ? className : (className ?? []).join(" "))?.[1] ?? null;

/** Markdown ends every code block with a line break the code doesn't have. Dropped, so line counts and copied text are exact. */
const dropFinalBreak = (code: HastNode): void => {
	const last = code.children?.at(-1);
	if (last?.type === "text" && last.value) last.value = last.value.replace(/\r?\n$/, "");
};

const prepareFence = (code: HastNode): void => {
	const properties = code.properties ?? {};
	const classNames = properties.className ?? [];
	const typed = readFenceLanguage(classNames);
	// Kirari's plugin reads the `{2,4-6}` from `data.meta`, which the HTML parsing step drops; the text survives as `metastring`.
	if (typeof properties.metastring === "string") code.data = { ...code.data, meta: properties.metastring };
	// Kirari's plugin colors a block by the first `language-` class it knows. Ours follows the typed one, so names it
	// doesn't know (`console`, an unknown language, no language) still get the right language or plain lines.
	if (typed !== "mermaid") {
		properties.className = [...classNames, `language-${resolveCodeLanguage(typed) ?? "plaintext"}`];
		code.properties = properties;
	}
	dropFinalBreak(code);
};

/**
 * Gets each fenced block ready for Kirari's plugin, which runs right after. Diagrams
 * (```` ```mermaid ````) are left alone: they are not code to color.
 */
export const rehypePrepareFences = () => (tree: HastNode): void => {
	const visit = (node: HastNode): void => {
		if (node.type === "element" && node.tagName === "pre") {
			node.children?.filter((child) => child.type === "element" && child.tagName === "code").forEach(prepareFence);
			return;
		}
		node.children?.forEach(visit);
	};
	visit(tree);
};

/**
 * Streamdown's HTML cleaning step with the docs components' tags let through. Streamdown does
 * that itself only while its plugin list is untouched; ours ends with the highlighter, so the
 * same step is built here, the way Streamdown builds it.
 */
const allowTags = ({ step, allowedTags }: { step: Pluggable; allowedTags: Record<string, string[]> }): Pluggable => {
	if (!Array.isArray(step)) {
		throw new Error("Streamdown's HTML cleaning step is no longer a plugin with settings; update rehype-plugins.ts to match it.");
	}
	const [plugin, schema] = step as [Plugin, SanitizeSchema];
	return [plugin, { ...schema, tagNames: [...(schema.tagNames ?? []), ...Object.keys(allowedTags)], attributes: { ...schema.attributes, ...allowedTags } }];
};

/**
 * Streamdown's HTML steps, then Kirari's plugin to color fenced code. The order is Kirari's: the
 * page is cleaned first (scripts and event handlers gone, `language-` classes kept), and the
 * plugin runs on what is left, so what it adds is never cleaned away and never needs trusting.
 * Passing plugins to Streamdown replaces its own, so they are spread in again here.
 */
export const buildRehypePlugins = ({ allowedTags }: { allowedTags: Record<string, string[]> }): Pluggable[] => [
	...Object.values({ ...defaultRehypePlugins, sanitize: allowTags({ step: defaultRehypePlugins.sanitize, allowedTags }) }),
	rehypePrepareFences as Pluggable,
	[rehypeKirari, KIRARI_REHYPE_OPTIONS],
];
