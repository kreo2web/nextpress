import { createDefaultBlock } from "../block-catalog/create-default-block.js";
import type { BlockConfig, BlockContent } from "../schema-types.js";

/** What a block's content can hold: text, numbers, flags, and lists or objects of them. */
export type BlockFields = Record<string, string | number | boolean | object | null>;

/** The block's content with `fields` written over it. A block with no saved content gets a structured one. */
const withFields = (content: BlockContent | undefined, fields: BlockFields): BlockContent => {
	if (content && content.kind !== "structured") return { ...content, ...fields } as BlockContent;
	return { kind: "structured", data: { ...(content?.data ?? {}), ...fields } };
};

/**
 * A block as the editor inserts it, with `fields` in its content and `children` inside it. Every field
 * not given keeps the catalog's default, and each child is re-parented to this block. Throws for a name
 * the catalog does not know: the converter only builds blocks that ship with NextPress.
 */
export const buildBlock = ({
	name,
	newId,
	fields = {},
	children = [],
}: {
	name: string;
	newId: () => string;
	fields?: BlockFields;
	children?: BlockConfig[];
}): BlockConfig => {
	const block = createDefaultBlock({ name, id: newId(), newId });
	if (!block) throw new Error(`Block catalog has no "${name}", so the MDX converter cannot build it.`);
	const content = withFields(block.content, fields);
	if (block.type !== "container") return { ...block, content };
	return { ...block, content, children: children.map((child) => ({ ...child, parentId: block.id })) };
};
