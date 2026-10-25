import type { JSX, ReactNode } from "react";
import type { DocComponentAllowlist } from "./safe-mdx.js";

/** MDX tags that hold other content and lay it out: the same looks as the Tabs, Steps, Card and Code group blocks. */
export const CONTAINER_DOC_PROPS = {
	Tabs: [],
	Tab: ["title"],
	CodeGroup: [],
	Steps: ["marker"],
	Step: ["title", "icon"],
	Cards: ["cols"],
	Card: ["title", "href"],
	Accordion: ["title"],
	Update: ["label", "description"],
} as const satisfies DocComponentAllowlist;

/**
 * MDX tags that stand alone: callouts (and the short names other docs tools use for them), file
 * trees, parameters, code examples and the inline Kbd and Badge.
 */
export const LEAF_DOC_PROPS = {
	Callout: ["type", "title"],
	Note: ["title"],
	Tip: ["title"],
	Warning: ["title"],
	Danger: ["title"],
	Info: ["title"],
	Check: ["title"],
	FileTree: [],
	Param: ["name", "type", "default", "required"],
	Example: ["layout"],
	Kbd: [],
	Badge: ["tone", "look"],
} as const satisfies DocComponentAllowlist;

/**
 * Every component MDX in a page may use, with the props each takes. One list for the parser (what
 * survives), the sanitizer (which tags and attributes pass) and the renderer. Add a docs component
 * here and nowhere else in the markdown code.
 */
export const DOC_COMPONENT_PROPS = { ...CONTAINER_DOC_PROPS, ...LEAF_DOC_PROPS } as const satisfies DocComponentAllowlist;

export type DocComponentName = keyof typeof DOC_COMPONENT_PROPS;
export type ContainerDocName = keyof typeof CONTAINER_DOC_PROPS;
export type LeafDocName = keyof typeof LEAF_DOC_PROPS;

/**
 * Attributes NextPress sets itself, after the author's props are filtered, so an author can never
 * set them: `index` numbers each Tabs and CodeGroup in a document so their tab ids are unique.
 */
export const DOC_COMPONENT_INTERNAL_ATTRIBUTES: Partial<Record<DocComponentName, readonly string[]>> = {
	Tabs: ["index"],
	CodeGroup: ["index"],
};

/** Props as the renderer hands them over: only the allowlisted ones, always as text. */
export type DocComponentProps = Record<string, unknown> & { children?: ReactNode };
export type DocComponentView = (props: DocComponentProps) => JSX.Element;

/** A prop as text, or undefined when the author left it out. */
export const docProp = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);
