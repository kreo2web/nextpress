import { createDefaultBlock } from "@shared/block-catalog";
import { fitToDocsColumn } from "@shared/docs/docs-column-spacing";
import type { JsonObject } from "@shared/blocks/docs-types";
import type { BlockConfig } from "@shared/schema-types";
import { deleteBlockDeep, findBlock, findParentBlock, updateBlockDeep } from "@/lib/handlers/treeUtils";

/**
 * Writing in the docs editor, as plain rules on the page's blocks: what Enter, Backspace, a marker
 * typed at the start of a paragraph and the "/" menu do. Kept apart from the screen so each rule is
 * tested on its own; the docs editor applies the result as one undo step.
 */

/** The block a paragraph becomes, and the fields it starts with. */
export type WritingTurn = { name: string; data: JsonObject };

const escapeHtml = (text: string): string => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const oneLine = (text: string): string => text.replace(/\s*\n\s*/g, " ");
const listOf = ({ style, text }: { style: "bullet" | "number" | "check"; text: string }): WritingTurn => ({
	name: "docs/list",
	data: { style, items: [{ text: oneLine(text), checked: false, children: [] }] },
});

/** Markers in the order they are tried; each takes the text typed after it along. */
const MARKERS: ReadonlyArray<{ pattern: RegExp; turn: (match: RegExpMatchArray) => WritingTurn }> = [
	{ pattern: /^(#{2,4}) ([\s\S]*)$/, turn: (match) => ({ name: "docs/heading", data: { level: match[1].length, text: oneLine(match[2]), anchor: "" } }) },
	{ pattern: /^\[ ?\] ([\s\S]*)$/, turn: (match) => listOf({ style: "check", text: match[1] }) },
	{ pattern: /^[-*] ([\s\S]*)$/, turn: (match) => listOf({ style: "bullet", text: match[1] }) },
	{ pattern: /^1[.)] ([\s\S]*)$/, turn: (match) => listOf({ style: "number", text: match[1] }) },
	{ pattern: /^> ([\s\S]*)$/, turn: (match) => ({ name: "core/quote", data: { value: `<p>${escapeHtml(oneLine(match[1]))}</p>`, citation: "" } }) },
	{ pattern: /^```([\s\S]*)$/, turn: (match) => ({ name: "core/code", data: { content: match[1].replace(/^\n/, ""), language: "" } }) },
];

/**
 * The block a paragraph turns into when a marker at its start was just completed (`## `, `- `,
 * `1. `, `[] `, `> `, three backticks). Null when nothing was completed by this change: a paragraph
 * that already started with "- " and is edited further stays a paragraph.
 */
export function readWritingTurn({ previous, next }: { previous: string; next: string }): WritingTurn | null {
	for (const { pattern, turn } of MARKERS) {
		const match = next.match(pattern);
		if (match && !pattern.test(previous)) return turn(match);
	}
	return null;
}

/** What follows a "/" that opens a paragraph, or null when the paragraph is not a "/" command. */
export function readSlashQuery(text: string): string | null {
	const match = text.match(/^\/([a-z0-9 -]*)$/i);
	return match ? match[1] : null;
}

/** The text on either side of the selection, for Enter splitting a paragraph in two. */
export const splitText = ({ text, start, end }: { text: string; start: number; end: number }): { before: string; after: string } => ({
	before: text.slice(0, start),
	after: text.slice(end),
});

/** A new block of `name` with the catalog's starting fields and `data` on top, or null for a name NextPress does not know. */
export function buildWritingBlock({ name, data = {}, newId, parentId }: { name: string; data?: JsonObject; newId: () => string; parentId: string | null }): BlockConfig | null {
	const made = createDefaultBlock({ name, id: newId(), newId });
	if (!made) return null;
	const block = fitToDocsColumn(made);
	const current = block.content && "kind" in block.content && block.content.kind === "structured" ? block.content.data : null;
	return current ? { ...block, parentId, content: { kind: "structured", data: { ...current, ...data } } } : { ...block, parentId };
}

const withData = ({ block, data }: { block: BlockConfig; data: JsonObject }): Partial<BlockConfig> => {
	const current = block.content && "kind" in block.content && block.content.kind === "structured" ? block.content.data : {};
	return { content: { kind: "structured", data: { ...current, ...data } } };
};

/**
 * Puts `block` right after `targetId`, wherever that sits in the tree, keeping every id `block`
 * already has (new blocks come with fresh ids for themselves and everything inside them).
 */
function insertAfter({ blocks, targetId, block }: { blocks: BlockConfig[]; targetId: string; block: BlockConfig }): BlockConfig[] | null {
	const index = blocks.findIndex((candidate) => candidate.id === targetId);
	if (index >= 0) return [...blocks.slice(0, index + 1), block, ...blocks.slice(index + 1)];
	for (const [position, candidate] of blocks.entries()) {
		const children = candidate.children ? insertAfter({ blocks: candidate.children, targetId, block }) : null;
		if (children) return blocks.map((original, at) => (at === position ? { ...original, children } : original));
	}
	return null;
}

/** Where an edit leaves the writer: the block to edit next and where the caret goes in it. */
export type WritingResult = { blocks: BlockConfig[]; editId: string; caret: "start" | "end" };

/** Enter in a paragraph or heading: it keeps the text before the caret, and a new paragraph after it starts with the rest. */
export function splitBlock({ blocks, blockId, field, before, after, newId }: { blocks: BlockConfig[]; blockId: string; field: string; before: string; after: string; newId: () => string }): WritingResult | null {
	const block = findBlock(blocks, blockId);
	if (!block) return null;
	const paragraph = buildWritingBlock({ name: "docs/text", data: { text: after }, newId, parentId: findParentBlock(blocks, blockId)?.id ?? null });
	if (!paragraph) return null;
	const kept = updateBlockDeep(blocks, blockId, withData({ block, data: { [field]: before } })).next;
	const next = insertAfter({ blocks: kept, targetId: blockId, block: paragraph });
	return next ? { blocks: next, editId: paragraph.id, caret: "start" } : null;
}

/** A marker or the "/" menu: the paragraph is replaced by the new block, which opens for editing. */
export function replaceBlock({ blocks, blockId, name, data, newId }: { blocks: BlockConfig[]; blockId: string; name: string; data?: JsonObject; newId: () => string }): WritingResult | null {
	const replacement = buildWritingBlock({ name, data, newId, parentId: findParentBlock(blocks, blockId)?.id ?? null });
	if (!replacement) return null;
	const next = insertAfter({ blocks, targetId: blockId, block: replacement });
	if (!next) return null;
	return { blocks: deleteBlockDeep(next, blockId).next, editId: replacement.id, caret: "end" };
}

/** Blocks a writer can carry on typing in, so Backspace in an empty paragraph moves into the one above. */
const TYPED_IN: ReadonlySet<string> = new Set(["docs/text", "docs/heading", "docs/list"]);

/** Backspace in an empty paragraph: it goes, and the writer continues at the end of the block above when that one takes typing. */
export function removeEmptyBlock({ blocks, blockId }: { blocks: BlockConfig[]; blockId: string }): (Omit<WritingResult, "editId"> & { editId: string | null }) | null {
	const parent = findParentBlock(blocks, blockId);
	const siblings = parent?.children ?? blocks;
	const index = siblings.findIndex((child) => child.id === blockId);
	if (index < 0) return null;
	const above = index > 0 ? siblings[index - 1] : null;
	return { blocks: deleteBlockDeep(blocks, blockId).next, editId: above && TYPED_IN.has(above.name) ? above.id : null, caret: "end" };
}
