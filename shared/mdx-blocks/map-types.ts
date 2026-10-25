import type { MdxNode } from "../markdown/mdx-tree.js";
import type { ParamItem } from "../blocks/params-model.js";
import type { BlockConfig } from "../schema-types.js";

/**
 * What a mapper gets from the converter: the text the tree's positions point into (so words are kept
 * as written), the id maker, and the way to map the children of a component, which reuses the same
 * mapping for every level.
 */
export type MapContext = {
	source: string;
	newId: () => string;
	mapChildren: (nodes: MdxNode[]) => BlockConfig[];
};

/**
 * One element as the converter reads it. A `block` is its own block; a `param` joins its neighbours in one
 * docs/params block; an `accordion` item joins its neighbours in one accordion. Null means no docs block holds
 * it, so it stays in a markdown block, word for word.
 */
export type Mapped = { kind: "block"; block: BlockConfig } | { kind: "param"; item: ParamItem } | { kind: "accordion"; item: BlockConfig } | null;

/** Maps one component element (its tag, props and children) into a `Mapped`. */
export type Mapper = (args: { ctx: MapContext; node: MdxNode }) => Mapped;
