import type { BlockConfig } from "@shared/schema-types";
import {
	copyTemplateBlocks,
	isTemplatePartBlock,
	MAX_TEMPLATE_PART_DEPTH,
	readTemplatePartId,
} from "@shared/template-parts";

/** Template blocks by template id, for the templates already fetched. */
export type TemplateBlocksById = Readonly<Record<string, readonly BlockConfig[]>>;

const sequentialIds = (prefix: string): (() => string) => {
	let next = 0;
	return () => {
		next += 1;
		return `${prefix}-${next}`;
	};
};

/**
 * Swaps each linked template part for its template's blocks, as the published page does on the
 * server. Used by the editor's live preview, which shows the editor's own blocks (still holding
 * parts). A part whose template isn't loaded, points back at itself, or sits deeper than
 * MAX_TEMPLATE_PART_DEPTH shows nothing, the same as on the published page.
 */
export function spliceTemplateParts({
	blocks,
	templates,
	depth = 1,
	chain = [],
}: {
	blocks: readonly BlockConfig[];
	templates: TemplateBlocksById;
	depth?: number;
	chain?: readonly string[];
}): BlockConfig[] {
	return blocks.flatMap((block) => {
		if (!isTemplatePartBlock(block)) {
			return Array.isArray(block.children)
				? [{ ...block, children: spliceTemplateParts({ blocks: block.children, templates, depth, chain }) }]
				: [block];
		}

		const templateId = readTemplatePartId(block);
		const templateBlocks = templateId ? templates[templateId] : undefined;
		if (!templateId || !templateBlocks || depth > MAX_TEMPLATE_PART_DEPTH || chain.includes(templateId)) return [];

		const copies = copyTemplateBlocks({
			templateBlocks,
			parentId: block.parentId ?? null,
			generateId: sequentialIds(block.id),
		});
		return spliceTemplateParts({ blocks: copies, templates, depth: depth + 1, chain: [...chain, templateId] });
	});
}
