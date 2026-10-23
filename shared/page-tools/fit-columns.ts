import type { BlockConfig } from "../schema-types.js";
import { equalColumnWidth } from "./equal-columns.js";
import { isRecord, readContentRecord } from "./is-record.js";
import { findBlockById, walkBlocks } from "./tree-find.js";
import type { BlockPatchOp } from "./types.js";

const COLUMNS_BLOCK_NAME = "core/columns";

type UpdateOp = Extract<BlockPatchOp, { op: "update" }>;

type Column = { columnId: string; width?: string; blockIds: string[] };

const isColumn = (value: unknown): value is Column =>
	isRecord(value) &&
	typeof value.columnId === "string" &&
	Array.isArray(value.blockIds) &&
	value.blockIds.every((id) => typeof id === "string");

/** The saved layout: `settings.columnLayout`, or the old copy in content that older pages keep. */
const readSavedLayout = (block: BlockConfig): Column[] => {
	const fromSettings = block.settings?.columnLayout;
	if (Array.isArray(fromSettings) && fromSettings.length > 0) return fromSettings.filter(isColumn);
	const content = readContentRecord(block.content);
	const data = content && isRecord(content.data) ? content.data : null;
	return data && Array.isArray(data.columnLayout) ? data.columnLayout.filter(isColumn) : [];
};

const childIdsOf = (block: BlockConfig | null): string[] => (block?.children ?? []).map((child) => child.id);

const sameIds = (a: string[], b: string[]): boolean => a.length === b.length && a.every((id, index) => id === b[index]);

/**
 * The layout after children came and went: gone children leave their column, and each new child
 * takes the first empty column or, when none is left, a new column of its own. Adding columns
 * makes them all equal width again. Null when nothing changes.
 */
const refitLayout = ({ block, newId }: { block: BlockConfig; newId: () => string }): Column[] | null => {
	const childIds = childIdsOf(block);
	const saved = readSavedLayout(block);
	const present = new Set(childIds);
	const columns = saved.map((column) => ({ ...column, blockIds: column.blockIds.filter((id) => present.has(id)) }));
	const placed = new Set(columns.flatMap((column) => column.blockIds));
	let added = 0;
	for (const id of childIds.filter((childId) => !placed.has(childId))) {
		const empty = columns.find((column) => column.blockIds.length === 0);
		if (empty) empty.blockIds.push(id);
		else {
			columns.push({ columnId: `col-${newId()}`, blockIds: [id] });
			added++;
		}
	}
	const sized = added > 0 ? columns.map((column) => ({ ...column, width: equalColumnWidth(columns.length) })) : columns;
	return JSON.stringify(sized) === JSON.stringify(saved) ? null : sized;
};

/**
 * Update ops that keep each Columns block side by side after a change added, moved or removed
 * its children. Columns keeps which child sits in which column by id, and without this a block
 * an agent adds to an existing Columns block lands in the first column under the others.
 * Only Columns blocks whose children this change altered are touched; others keep their look.
 */
export const fitChangedColumns = ({
	before,
	after,
	newId,
}: {
	before: BlockConfig[];
	after: BlockConfig[];
	newId: () => string;
}): UpdateOp[] => {
	const ops: UpdateOp[] = [];
	walkBlocks({
		blocks: after,
		visit: (block) => {
			if (block.name !== COLUMNS_BLOCK_NAME) return;
			if (sameIds(childIdsOf(findBlockById({ blocks: before, id: block.id })), childIdsOf(block))) return;
			const columnLayout = refitLayout({ block, newId });
			if (columnLayout) ops.push({ op: "update", id: block.id, set: { settings: { ...block.settings, columnLayout } } });
		},
	});
	return ops;
};
