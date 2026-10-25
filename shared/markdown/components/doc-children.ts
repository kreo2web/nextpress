import { Children, createContext, isValidElement, type ReactElement, type ReactNode } from "react";
import { parseCodeFenceMeta } from "../code-meta.js";
import type { DocComponentProps } from "../doc-component-props.js";

/** The syntax-tree node React hands each element (react-markdown's `node` prop), as far as these views read it. */
type HastNode = { tagName?: string; properties?: { className?: string[]; metastring?: string }; children?: HastNode[] };

export type DocElement = ReactElement<DocComponentProps & { node?: HastNode }>;

/**
 * The page's markdown block id, so the tabs of one markdown block never share an id with another's.
 * Set by `MarkdownView`; without it (chat) ids stay unique within the message.
 */
export const MarkdownIdContext = createContext<string>("md");

const isBlank = (child: ReactNode): boolean => typeof child === "string" && child.trim() === "";

/** Every child that isn't blank text, in the order the author wrote them. */
export const listDocChildren = (children: ReactNode): ReactNode[] => Children.toArray(children).filter((child) => !isBlank(child));

/** The element's tag in the markdown tree (`np-tab`, `pre`), or null for text. */
export const tagOf = (child: ReactNode): string | null => (isValidElement(child) ? ((child as DocElement).props.node?.tagName ?? null) : null);

/**
 * A tag's children split into the ones that are `tag` (a Tab inside Tabs) and everything else.
 * Blank text between tags is dropped, so a newline between two Tabs never becomes content.
 */
export const splitDocChildren = ({ children, tag }: { children: ReactNode; tag: string }): { items: DocElement[]; others: ReactNode[] } => {
	const all = listDocChildren(children);
	return {
		items: all.filter((child): child is DocElement => tagOf(child) === tag),
		others: all.filter((child) => tagOf(child) !== tag),
	};
};

/** What names a fenced code block's tab: the `title=` on its fence and its language, read from the markdown tree. */
export const readFenceNames = (fence: DocElement): { title: string | null; language: string | null } => {
	const code = fence.props.node?.children?.find((node) => node.tagName === "code");
	const language = code?.properties?.className?.map((name) => /^language-(\S+)$/.exec(name)?.[1]).find(Boolean) ?? null;
	return { title: parseCodeFenceMeta(code?.properties?.metastring).title, language };
};
