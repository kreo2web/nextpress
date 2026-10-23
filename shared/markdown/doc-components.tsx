import type { JSX, ReactNode } from "react";
import { Callout } from "./callout.js";
import { type DocComponentAllowlist, docComponentTag } from "./safe-mdx.js";

/**
 * The components MDX in a page may use, with the props each takes. One list for the parser
 * (what survives), the sanitizer (which tags and attributes pass) and the renderer below.
 * Add a docs component here and nowhere else in the markdown code.
 */
export const DOC_COMPONENT_PROPS = {
	Callout: ["type", "title"],
} as const satisfies DocComponentAllowlist;

type DocComponentName = keyof typeof DOC_COMPONENT_PROPS;

/** Props as the renderer hands them over. Only the allowlisted ones reach here, always as text. */
type DocComponentProps = Record<string, unknown> & { children?: ReactNode };

const text = (value: unknown): string | undefined => (typeof value === "string" ? value : undefined);

const DOC_COMPONENT_VIEWS: Record<DocComponentName, (props: DocComponentProps) => JSX.Element> = {
	Callout: ({ type, title, children }) => (
		<Callout type={text(type)} title={text(title)}>
			{children}
		</Callout>
	),
};

const NAMES = Object.keys(DOC_COMPONENT_PROPS) as DocComponentName[];

/** The tags and attributes the sanitizer lets through, keyed by the tag each component becomes. */
export const DOC_COMPONENT_TAGS: Record<string, string[]> = Object.fromEntries(
	NAMES.map((name) => [docComponentTag(name), [...DOC_COMPONENT_PROPS[name]]]),
);

/** The renderer's components, keyed the same way. */
export const DOC_COMPONENT_RENDERERS: Record<string, (props: DocComponentProps) => JSX.Element> = Object.fromEntries(
	NAMES.map((name) => [docComponentTag(name), DOC_COMPONENT_VIEWS[name]]),
);
