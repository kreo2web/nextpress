import { escapeMdxBraces } from "../markdown/mdx-text.js";
import type { BlockConfig } from "../schema-types.js";
import { COMPONENT_WRITERS } from "./write-component.js";
import { ELEMENT_WRITERS } from "./write-element.js";
import type { BlockWriter, MdxWriteContext } from "./write-text.js";

export type BlocksToMdxResult = {
	mdx: string;
	/** Names of blocks that have no MDX form here (a gallery, a form), left out. */
	skipped: string[];
};

const WRITERS = new Map<string, BlockWriter>([...ELEMENT_WRITERS, ...COMPONENT_WRITERS]);

const writeBlock = ({ block, ctx }: { block: BlockConfig; ctx: MdxWriteContext }): string => {
	const writer = WRITERS.get(block.name);
	if (!writer) {
		ctx.skipped.push(block.name);
		return "";
	}
	return writer({ block, ctx });
};

const writeBlocks = ({ blocks, ctx }: { blocks: BlockConfig[]; ctx: MdxWriteContext }): string =>
	blocks
		.map((block) => writeBlock({ block, ctx }))
		.filter((part) => part !== "")
		.join("\n\n");

/**
 * Docs blocks as one MDX page, the reverse of `mdxToBlocks`. Each block is written as the element it is read
 * from (the spellings are in `write-element.ts` and `write-component.ts`), and blocks inside a component are
 * written inside its tags. Braces in text are escaped, since MDX would read them as code. A block with no MDX
 * form is left out and its name is listed in `skipped`, so the caller can say what was not exported.
 */
export const blocksToMdx = (blocks: BlockConfig[]): BlocksToMdxResult => {
	const ctx: MdxWriteContext = { skipped: [], writeChildren: (children) => writeBlocks({ blocks: children, ctx }) };
	const parts = writeBlocks({ blocks, ctx });
	return { mdx: parts ? `${escapeMdxBraces(parts)}\n` : "", skipped: [...new Set(ctx.skipped)] };
};
