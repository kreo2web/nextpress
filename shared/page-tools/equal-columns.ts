/** Which blocks sit in one column of a `core/columns` block (`settings.columnLayout`), by id. */
export type EqualColumn = { columnId: string; width: string; blockIds: string[] };

/** The width each of `count` equal columns gets, as the editor writes it. */
export const equalColumnWidth = (count: number): string => `${(100 / Math.max(count, 1)).toFixed(2)}%`;

/**
 * One equal-width column per group of block ids: the split the editor makes when you pick a
 * column count. With no groups there is still one empty column, as in the editor.
 * Used by the page tools and the SDK's Columns builder, so both lay columns out the same way.
 */
export const layoutEqualColumns = ({ groups, newId }: { groups: string[][]; newId: () => string }): EqualColumn[] => {
	const columns = groups.length > 0 ? groups : [[]];
	const width = equalColumnWidth(columns.length);
	return columns.map((blockIds) => ({ columnId: `col-${newId()}`, width, blockIds }));
};
