import type { BlockConfig } from "../schema-types.js";
import { createDefaultBlock } from "../block-catalog/create-default-block.js";
import { DOCS_SHELL_BLOCK_NAME, DEFAULT_DOCS_SHELL_CONTENT, findDocsShell, readDocsShellContent } from "../blocks/docs-shell-model.js";
import { DOCS_PAGE_BLOCK_NAME } from "../blocks/docs-page-model.js";
import { PAGE_SHELL_BLOCK_NAME } from "../page-shell-model.js";
import type { DocsSettings } from "./types.js";

/**
 * The frame every docs page has: page shell → docs shell → docs page → the page's own blocks.
 * Pure, so the server, the editor and tests build and read it the same way.
 */

/** The frame spans the window; the docs shell sets its own widths and spacing. */
const FRAME_STYLES = { boxSizing: "border-box", margin: "0", padding: "0", width: "100%" } as const;
const FULL_WIDTH_SHELL = { containerWidth: "100%", padding: "0" } as const;

/** The page design a docs page saves in `page.other.design`, so nothing outside the frame narrows it. */
export const DOCS_PAGE_DESIGN = { containerWidth: "100%", padding: "0" } as const;

const mustCreate = ({ name, newId }: { name: string; newId: () => string }): BlockConfig => {
	const block = createDefaultBlock({ name, id: newId(), newId });
	if (!block) throw new Error(`The block catalog has no "${name}" block; the docs frame can't be built.`);
	return block;
};

const withParent = (blocks: BlockConfig[], parentId: string): BlockConfig[] => blocks.map((block) => ({ ...block, parentId }));

/** A docs home's shell holds the docs-wide settings; every other page's shell inherits them. */
const shellContent = ({ home, settings }: { home: boolean; settings?: Partial<DocsSettings> }): BlockConfig["content"] => ({
	kind: "structured",
	data: home ? { ...DEFAULT_DOCS_SHELL_CONTENT, ...settings, inherit: false } : { ...DEFAULT_DOCS_SHELL_CONTENT, inherit: true },
});

/** A page's blocks with the docs frame around `children`. */
export function buildDocsPageBlocks({
	newId,
	home,
	settings,
	children,
}: {
	newId: () => string;
	home: boolean;
	settings?: Partial<DocsSettings>;
	children: BlockConfig[];
}): BlockConfig[] {
	const pageShell = mustCreate({ name: PAGE_SHELL_BLOCK_NAME, newId });
	const shell = mustCreate({ name: DOCS_SHELL_BLOCK_NAME, newId });
	const page = mustCreate({ name: DOCS_PAGE_BLOCK_NAME, newId });
	const docsPage: BlockConfig = { ...page, parentId: shell.id, styles: { ...FRAME_STYLES }, children: withParent(children, page.id) };
	const docsShell: BlockConfig = {
		...shell,
		parentId: pageShell.id,
		styles: { ...FRAME_STYLES },
		content: shellContent({ home, settings }),
		children: [docsPage],
	};
	const pageShellData = pageShell.content?.kind === "structured" ? pageShell.content.data : {};
	return [
		{
			...pageShell,
			parentId: null,
			content: { kind: "structured", data: { ...pageShellData, ...FULL_WIDTH_SHELL } },
			children: [docsShell],
		},
	];
}

/** The first block with this name anywhere in the tree. */
const findBlock = (blocks: BlockConfig[], name: string): BlockConfig | null => {
	for (const block of blocks) {
		if (block.name === name) return block;
		const inner = Array.isArray(block.children) ? findBlock(block.children, name) : null;
		if (inner) return inner;
	}
	return null;
};

/** True for any page inside a docs (its blocks hold a docs shell). */
export const isDocsPageBlocks = (blocks: BlockConfig[]): boolean => findDocsShell(blocks) !== null;

/** True for a docs home: its shell keeps its own settings instead of inheriting them. */
export const isDocsHomeBlocks = (blocks: BlockConfig[]): boolean => {
	const shell = findDocsShell(blocks);
	return shell !== null && !readDocsShellContent(shell.content).inherit;
};

/** The page's own blocks: the docs page's children, or none when the frame is missing. */
export const readDocsPageContent = (blocks: BlockConfig[]): BlockConfig[] => {
	const page = findBlock(blocks, DOCS_PAGE_BLOCK_NAME);
	return Array.isArray(page?.children) ? page.children : [];
};

/** The same blocks with the docs page's children replaced; everything else is kept as it was. */
export function replaceDocsPageContent({ blocks, children }: { blocks: BlockConfig[]; children: BlockConfig[] }): BlockConfig[] {
	const replace = (list: BlockConfig[]): BlockConfig[] =>
		list.map((block) => {
			if (block.name === DOCS_PAGE_BLOCK_NAME) return { ...block, children: withParent(children, block.id) };
			return Array.isArray(block.children) ? { ...block, children: replace(block.children) } : block;
		});
	return replace(blocks);
}

/** The same blocks with the home shell's settings changed; refuses a page that is not a docs home. */
export function replaceDocsHomeSettings({ blocks, settings }: { blocks: BlockConfig[]; settings: Partial<DocsSettings> }): BlockConfig[] {
	const replace = (list: BlockConfig[]): BlockConfig[] =>
		list.map((block) => {
			if (block.name === DOCS_SHELL_BLOCK_NAME) {
				const current = readDocsShellContent(block.content);
				return { ...block, content: { kind: "structured", data: { ...current, ...settings, inherit: false } } };
			}
			return Array.isArray(block.children) ? { ...block, children: replace(block.children) } : block;
		});
	return replace(blocks);
}

/** The docs-wide settings kept on a home page's shell (defaults when the shell is missing). */
export function readDocsSettings(blocks: BlockConfig[]): DocsSettings {
	const shell = findDocsShell(blocks);
	const content = readDocsShellContent(shell?.content);
	return {
		title: content.title,
		logoUrl: content.logoUrl,
		logoDarkUrl: content.logoDarkUrl,
		links: content.links,
		button: content.button,
		search: content.search,
		features: content.features,
	};
}
