import type { BlockDefinition } from "../blocks/types";

/**
 * How the docs inserter groups its blocks: the sections of the docs editor mockup. A block that
 * is in the Docs group but in no section here (a new docs block nobody sorted yet) still shows,
 * under "More", so adding a docs block never needs a change here to be usable.
 */

export type DocsLibrarySection = { id: string; name: string; blocks: BlockDefinition[] };

const SECTIONS: ReadonlyArray<{ id: string; name: string; ids: readonly string[] }> = [
	{ id: "writing", name: "Writing", ids: ["docs/heading", "docs/text", "docs/list", "core/separator"] },
	{ id: "callouts", name: "Callouts", ids: ["docs/callout"] },
	{ id: "code", name: "Code", ids: ["core/code", "docs/code-group", "docs/example", "docs/diagram"] },
	{ id: "structure", name: "Structure", ids: ["core/steps", "core/tabs", "core/grid", "core/accordion", "core/table", "docs/file-tree"] },
	{ id: "reference", name: "Reference", ids: ["docs/params", "docs/update"] },
	{ id: "media", name: "Media", ids: ["core/image", "core/video"] },
];

/** Names shorter and plainer than the catalog's, for blocks that sit in a docs-only list already. */
const DISPLAY_LABELS: Readonly<Record<string, string>> = {
	"docs/heading": "Heading",
	"docs/text": "Text",
	"docs/list": "List",
	"core/separator": "Divider",
	"docs/example": "Example",
};

export const docsBlockLabel = (block: BlockDefinition): string => DISPLAY_LABELS[block.id] ?? block.label;

/** The blocks sorted into sections, in the order above; empty sections are left out. */
export function groupDocsBlocks(blocks: BlockDefinition[]): DocsLibrarySection[] {
	const byId = new Map(blocks.map((block) => [block.id, block]));
	const placed = new Set<string>();
	const sections = SECTIONS.map(({ id, name, ids }) => {
		const inSection = ids.flatMap((blockId) => {
			const block = byId.get(blockId);
			return block ? [block] : [];
		});
		inSection.forEach((block) => placed.add(block.id));
		return { id, name, blocks: inSection };
	});
	const rest = blocks.filter((block) => !placed.has(block.id));
	return [...sections, { id: "more", name: "More", blocks: rest }].filter((section) => section.blocks.length > 0);
}

/** Blocks whose label or description holds the words typed in the search box. */
export function searchDocsBlocks({ blocks, query }: { blocks: BlockDefinition[]; query: string }): BlockDefinition[] {
	const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
	if (words.length === 0) return blocks;
	return blocks.filter((block) => {
		const haystack = `${docsBlockLabel(block)} ${block.label} ${block.description ?? ""}`.toLowerCase();
		return words.every((word) => haystack.includes(word));
	});
}
