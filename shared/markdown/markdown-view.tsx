import { createElement, useMemo, type ComponentType, type JSX, type ReactNode } from "react";
import remarkMdx from "remark-mdx";
import { type Components, defaultRemarkPlugins, type ExtraProps, Streamdown } from "streamdown";
import type { Pluggable } from "unified";
import { resolveCodeLanguage } from "./code-languages.js";
import { parseCodeFenceMeta } from "./code-meta.js";
import { CodeFrame } from "./code-view.js";
import { type DiagramRenderer, DiagramView } from "./diagram-view.js";
import { MarkdownIdContext } from "./components/doc-children.js";
import { remarkDocComponentIds } from "./doc-component-ids.js";
import { DOC_COMPONENT_PROPS, DOC_COMPONENT_RENDERERS, DOC_COMPONENT_TAGS } from "./doc-components.js";
import { readHeadingId, remarkHeadingIds } from "./heading-ids.js";
import { escapeMdxBraces } from "./mdx-text.js";
import { parseMarkdown } from "./parse-markdown.js";
import { buildRehypePlugins, readFenceLanguage } from "./rehype-plugins.js";
import { remarkSafeMdx } from "./safe-mdx.js";

export type MarkdownViewProps = {
	text: string;
	/** Read the text as MDX (docs components like `<Callout>`). Text that doesn't parse as MDX shows as plain markdown. */
	mdx?: boolean;
	/** "streaming" while an AI reply is still arriving; pages are "static". */
	mode?: "static" | "streaming";
	/** Draws diagrams on the server. Without it, the browser loads the diagram library when a page has one. */
	renderDiagram?: DiagramRenderer;
	/** Copy for code blocks where React runs (chat). Published pages copy through `code.js`. */
	onCopyCode?: (code: string) => void;
	/** The markdown block's id. Tabs in MDX build their element ids from it, so two markdown blocks on one page never clash. */
	idPrefix?: string;
	className?: string;
};

/** The syntax-tree node React hands each element (its `node` prop), as far as the code fence reads it. */
type HastNode = { type?: string; value?: string; properties?: { metastring?: string }; children?: HastNode[] };
type ElementProps = Record<string, unknown> & ExtraProps & { children?: ReactNode; className?: string; id?: string };
/** The props Streamdown hands an override for one HTML element. */
type PropsOf<Tag extends keyof JSX.IntrinsicElements> = JSX.IntrinsicElements[Tag] & ExtraProps;

const PLAIN_TAGS = [
	"p", "ul", "ol", "li", "blockquote", "hr", "strong", "em", "del", "sup", "sub", "section",
	"thead", "tbody", "tr", "th", "td", "br",
] as const;
const HEADING_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6"] as const;

/** An element as plain HTML: Streamdown's own Tailwind classes and its `node` prop dropped, so `np-prose` styles it. */
const plainElement =
	(tag: string): ComponentType<ElementProps> =>
	({ node: _node, ...props }) =>
		createElement(tag, props);

const heading =
	(tag: string): ComponentType<ElementProps> =>
	({ node: _node, id, ...props }) =>
		createElement(tag, { ...props, id: readHeadingId(id) });

/** The text inside a syntax-tree node with the tags removed: the code as the author wrote it, whatever the highlighter wrapped around it. */
const readNodeText = (node: HastNode | undefined): string =>
	node?.type === "text" ? (node.value ?? "") : (node?.children ?? []).map(readNodeText).join("");

/**
 * Fenced code. Mermaid becomes a diagram. Everything else arrives already colored by Kirari's
 * plugin (see `rehype-plugins.ts`), so its lines are forwarded as they are into our code frame,
 * which adds the fence's title, the language name, line numbers and the copy button.
 */
const createCodeFence =
	({ renderDiagram, onCopyCode }: Pick<MarkdownViewProps, "renderDiagram" | "onCopyCode">): ComponentType<PropsOf<"code">> =>
	({ className, children, node }) => {
		const typed = readFenceLanguage(className);
		const tree = node as HastNode | undefined;
		const code = readNodeText(tree);
		const meta = parseCodeFenceMeta(tree?.properties?.metastring);
		if (typed === "mermaid") return <DiagramView source={code} render={renderDiagram} caption={meta.title} />;
		return (
			<CodeFrame
				language={resolveCodeLanguage(typed)}
				title={meta.title}
				showLineNumbers={meta.showLineNumbers}
				wrapLines={meta.wrap}
				fold={meta.fold}
				copyText={code}
				onCopy={onCopyCode}>
				{children}
			</CodeFrame>
		);
	};

/** Links to other sites open in a new tab; links within the site stay in this one (the sanitizer marks every link `_blank`). */
const Link = ({ node: _node, href, target: _target, rel: _rel, children, ...props }: PropsOf<"a">): JSX.Element => {
	const isExternal = typeof href === "string" && /^https?:\/\//i.test(href);
	return (
		<a {...props} href={href} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noopener noreferrer" : undefined}>
			{children}
		</a>
	);
};

const Image = ({ node: _node, src, alt, title }: PropsOf<"img">): JSX.Element => (
	<img src={typeof src === "string" ? src : undefined} alt={alt ?? ""} title={title} loading="lazy" />
);

/** Wide tables scroll sideways inside the column instead of pushing the page wider. */
const Table = ({ node: _node, children, ...props }: PropsOf<"table">): JSX.Element => (
	<div className="np-table">
		<table {...props}>{children}</table>
	</div>
);

const InlineCode = ({ node: _node, children }: PropsOf<"code">): JSX.Element => <code className="np-inline-code">{children}</code>;

const buildComponents = (options: Pick<MarkdownViewProps, "renderDiagram" | "onCopyCode">): Components => ({
	...Object.fromEntries(PLAIN_TAGS.map((tag) => [tag, plainElement(tag)])),
	...Object.fromEntries(HEADING_TAGS.map((tag) => [tag, heading(tag)])),
	a: Link,
	img: Image,
	table: Table,
	code: createCodeFence(options),
	inlineCode: InlineCode,
	...DOC_COMPONENT_RENDERERS,
});

/** Built once: Streamdown's HTML steps with the docs tags allowed, then Kirari's plugin for fenced code. */
const REHYPE_PLUGINS = buildRehypePlugins({ allowedTags: DOC_COMPONENT_TAGS });

/**
 * Markdown (or MDX) as NextPress shows it everywhere: the editor, published pages (rendered on the
 * server) and the AI chat. GitHub tables and task lists, colored code, Mermaid diagrams, anchored
 * headings, and the docs components in `doc-components.tsx`. Raw HTML is sanitized; MDX is never run.
 */
export function MarkdownView({ text, mdx = false, mode = "static", renderDiagram, onCopyCode, idPrefix, className }: MarkdownViewProps): JSX.Element {
	// MDX that doesn't parse would throw mid-render; it shows as plain markdown instead (the editor says why).
	const useMdx = useMemo(
		() => mdx && mode === "static" && parseMarkdown({ text, mdx: true, components: DOC_COMPONENT_PROPS }).ok,
		[text, mdx, mode],
	);
	const components = useMemo(() => buildComponents({ renderDiagram, onCopyCode }), [renderDiagram, onCopyCode]);
	const remarkPlugins = useMemo(
		(): Pluggable[] => [
			...Object.values(defaultRemarkPlugins),
			...(useMdx ? ([remarkMdx, [remarkSafeMdx, { components: DOC_COMPONENT_PROPS }], remarkDocComponentIds] as Pluggable[]) : []),
			remarkHeadingIds as Pluggable,
		],
		[useMdx],
	);

	return (
		<MarkdownIdContext.Provider value={idPrefix ?? "md"}>
			<Streamdown
				mode={mode}
				// Streamdown puts `space-y-4` on its wrapper; this conflicting class makes tailwind-merge drop it, so the
				// spacing in markdown-css.ts applies. It has no CSS of its own (`unset` is invalid inside calc()).
				className={["np-prose space-y-[unset]", className].filter(Boolean).join(" ")}
				remarkPlugins={remarkPlugins}
				rehypePlugins={REHYPE_PLUGINS}
				allowedTags={DOC_COMPONENT_TAGS}
				components={components}>
				{useMdx ? escapeMdxBraces(text) : text}
			</Streamdown>
		</MarkdownIdContext.Provider>
	);
}
