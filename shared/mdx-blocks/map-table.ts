import type { BlockConfig } from "../schema-types.js";
import type { MdxNode } from "../markdown/mdx-tree.js";
import { buildBlock } from "./build-block.js";
import { CORE_BLOCK_NAMES } from "./core-block-names.js";
import type { MapContext } from "./map-types.js";

type Cell = { content: string; tag: "th" | "td" };
type Row = { cells: Cell[] };

/** A cell's words when they are plain text (no emphasis, links or code) and hold no `&`, `<` or `>`, which a table cell would read as HTML. */
const cellText = (cell: MdxNode): string | null => {
	const parts = cell.children ?? [];
	if (parts.some((part) => part.type !== "text")) return null;
	const text = parts.map((part) => part.value ?? "").join("");
	return /[&<>]/.test(text) ? null : text;
};

const readRow = (row: MdxNode, tag: "th" | "td"): Row | null => {
	const texts = (row.children ?? []).map(cellText);
	if (texts.some((text) => text === null)) return null;
	return { cells: texts.map((text) => ({ content: text ?? "", tag })) };
};

/**
 * A GFM table as a table block: the first row is the header and the rest are body rows. Null when a cell
 * has markup, or a column is aligned (the block has no alignment), so the table stays as written.
 */
export const mapTable = ({ ctx, node }: { ctx: MapContext; node: MdxNode }): BlockConfig | null => {
	if ((node.align ?? []).some((align) => align !== null && align !== undefined)) return null;
	const [headRow, ...bodyRows] = node.children ?? [];
	if (!headRow) return null;
	const head = readRow(headRow, "th");
	const body = bodyRows.map((row) => readRow(row, "td"));
	if (!head || body.some((row) => row === null)) return null;
	return buildBlock({
		name: CORE_BLOCK_NAMES.table,
		newId: ctx.newId,
		fields: { head: [head], body: body.filter((row): row is Row => row !== null) },
	});
};
