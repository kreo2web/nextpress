import type { BlockConfig } from "../types/domain.js";
import { createBlockId } from "../blocks/create-block-id.js";
import { layoutEqualColumns } from "../blocks/shared-page-tools.js";

/** Column layout metadata persisted on `core/columns` (`settings.columnLayout`). */
export type ColumnLayout = {
	columnId: string;
	width?: string;
	blockIds: string[];
};

/** Default columns content — matches dashboard `columns-model.ts` (gap lives on styles). */
export const DEFAULT_COLUMNS_CONTENT = {
	layoutMode: "flex" as const,
	minColumnWidth: "220px",
	verticalAlignment: "top" as const,
	horizontalAlignment: "left" as const,
	direction: "row" as const,
	columnVerticalAlignment: "top" as const,
	columnHorizontalAlignment: "stretch" as const,
};

const getOrderedChildIds = (children: BlockConfig[], layout: ColumnLayout[]): string[] => {
	const childIds = children.map((child) => child.id);
	const assignedIds = new Set(
		layout.flatMap((column) => (Array.isArray(column.blockIds) ? column.blockIds : [])),
	);
	return childIds.filter((id) => assignedIds.has(id)).concat(
		childIds.filter((id) => !assignedIds.has(id)),
	);
};

/**
 * Builds a column layout and redistributes child blocks evenly across columns. The equal split
 * itself is the page tools' own, so the SDK builder and an agent's Columns come out the same.
 * @see client/src/components/PageBuilder/blocks/columns/columns-model.ts
 */
export const buildColumnsLayout = (
	count: number,
	children: BlockConfig[],
	previousLayout: ColumnLayout[] = [],
): ColumnLayout[] => {
	const safeCount = Math.max(1, count);
	const groups: string[][] = Array.from({ length: safeCount }, () => []);
	getOrderedChildIds(children, previousLayout).forEach((childId, index) => {
		groups[index % safeCount].push(childId);
	});
	return layoutEqualColumns({ groups, newId: createBlockId });
};

/** Builds columnLayout from explicit column groups (one group per column). */
export const buildColumnsLayoutFromGroups = (groups: BlockConfig[][]): ColumnLayout[] =>
	layoutEqualColumns({ groups: groups.map((group) => group.map((block) => block.id)), newId: createBlockId });
