import { createDefaultBlock } from "../../block-catalog/create-default-block.js";
import type { BlockConfig } from "../../schema-types.js";
import { createPageTools } from "../create-page-tools.js";
import { findBlockById } from "../tree-find.js";
import type { PageTool, PageToolContext, SiteLookups, TreeChange } from "../types.js";

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

type MemoryContextParams = {
	blocks: BlockConfig[];
	focusBlockId?: string | null;
	site?: SiteLookups;
	/** Makes `writeTree` refuse with this message. */
	failWrite?: string;
};

/**
 * A page held in memory, for tests. `readTree` hands out a copy, `writeTree` records every
 * accepted change and stores it, so the next read sees it, as the editor and the server do.
 */
export const createMemoryContext = ({ blocks, focusBlockId, site, failWrite }: MemoryContextParams) => {
	let tree = structuredClone(blocks);
	const writes: TreeChange[] = [];
	const errors: Array<{ tool: string; message: string }> = [];
	const ctx: PageToolContext = {
		readTree: async () => structuredClone(tree),
		writeTree: async (change) => {
			if (failWrite) return { ok: false, message: failWrite };
			writes.push(change);
			tree = structuredClone(change.blocks);
			return { ok: true };
		},
		focusBlockId,
		newId: () => crypto.randomUUID(),
		site,
		onError: ({ tool, error }) => errors.push({ tool, message: error.message }),
	};
	return { ctx, writes, errors, getTree: () => tree };
};

/** A block exactly as the editor inserts it, with a readable id. Starting children get `<id>-1`, `<id>-2`… */
export const makeBlock = ({
	name,
	id,
	children,
	content,
	styles,
	label,
}: {
	name: string;
	id: string;
	children?: BlockConfig[];
	content?: Record<string, unknown>;
	styles?: Record<string, string | number>;
	label?: string;
}): BlockConfig => {
	let counter = 0;
	const block = createDefaultBlock({ name, id, newId: () => `${id}-${++counter}` });
	if (!block) throw new Error(`test setup: unknown block ${name}`);
	return {
		...block,
		...(label ? { label } : {}),
		...(content ? { content: content as BlockConfig["content"] } : {}),
		...(styles ? { styles: { ...block.styles, ...styles } as BlockConfig["styles"] } : {}),
		...(children ? { children: children.map((child) => ({ ...child, parentId: id })) } : {}),
	};
};

/** A heading with the given words. */
export const makeHeading = ({ id, text, level = 2 }: { id: string; text: string; level?: number }): BlockConfig =>
	makeBlock({ name: "core/heading", id, content: { kind: "text", value: text, level } });

export const makeParagraph = ({ id, text }: { id: string; text: string }): BlockConfig =>
	makeBlock({ name: "core/paragraph", id, content: { kind: "text", value: text } });

/** A small page: a shell holding a stack (heading, paragraph) and a second paragraph. */
export const makeSamplePage = (): BlockConfig[] => [
	makeBlock({
		name: "core/page-shell",
		id: "shell",
		children: [
			makeBlock({
				name: "core/stack",
				id: "hero",
				label: "Hero",
				children: [makeHeading({ id: "title", text: "Welcome", level: 1 }), makeParagraph({ id: "intro", text: "Hello there" })],
			}),
			makeParagraph({ id: "outro", text: "Bye" }),
		],
	}),
];

export const findTool = (tools: PageTool[], name: string): PageTool => {
	const tool = tools.find((candidate) => candidate.name === name);
	if (!tool) throw new Error(`test setup: no tool named ${name}`);
	return tool;
};

/** Runs `change_blocks` on an in-memory page and returns the result with the recorded writes. */
export const changeBlocks = async ({
	blocks,
	ops,
	focusBlockId,
}: {
	blocks: BlockConfig[];
	ops: object[];
	focusBlockId?: string;
}) => {
	const memory = createMemoryContext({ blocks, focusBlockId });
	const result = await findTool(createPageTools(memory.ctx), "change_blocks").run({ ops });
	return { ...memory, result };
};

export const childrenOf = (blocks: BlockConfig[], id: string): BlockConfig[] =>
	blocks.length === 0 ? [] : (findBlockById({ blocks, id })?.children ?? []);
