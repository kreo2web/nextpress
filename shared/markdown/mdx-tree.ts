/** An attribute's `{…}` value as MDX parsed it: the JavaScript tree, read for literals and never run. */
export type MdxEstree = { type: string; body?: MdxEstree[]; expression?: MdxEstree; value?: string | number | boolean | null | object };

export type MdxExpression = { type?: string; value?: string; data?: { estree?: MdxEstree | null } };

export type MdxAttribute = { type: string; name?: string; value?: string | null | MdxExpression };

/**
 * A node of MDX as written, as far as the docs converter reads it. Nothing is filtered out, so
 * the converter can keep what it does not map exactly as the author wrote it (from `position`).
 */
export type MdxNode = {
	type: string;
	value?: string;
	depth?: number;
	alt?: string | null;
	url?: string;
	title?: string | null;
	/** Fenced code: the language, and the rest of the info line. */
	lang?: string | null;
	meta?: string | null;
	checked?: boolean | null;
	ordered?: boolean | null;
	start?: number | null;
	/** Tables: how each column is aligned, null when left to the default. */
	align?: Array<string | null> | null;
	/** JSX elements: the component's name (`Callout`) and the attributes it was written with. */
	name?: string | null;
	attributes?: MdxAttribute[];
	position?: { start: { offset?: number }; end: { offset?: number } };
	children?: MdxNode[];
};
