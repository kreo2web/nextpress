import React from "react";
import { LayoutGrid } from "lucide-react";
import { DEFAULT_GRID_CONTENT, GRID_ITEMS_CLASS, gridClassNames, gridStyleVars, readGridContent, type GridContent } from "@shared/blocks/grid-model";
import { ContainerChildren } from "../../BlockRenderer";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { GridSettings } from "./grid-settings";

/**
 * Canvas view: the same outer element, classes and CSS variables as the published page. The items
 * are ordinary child blocks, so they select, drag and reorder like any other.
 */
const GridBlock = createBlockDefinition<GridContent>({
	...catalogMeta("core/grid"),
	icon: LayoutGrid,
	handlesOwnChildren: true,
	defaultContent: DEFAULT_GRID_CONTENT,
	parseContent: (raw) => readGridContent(raw),
	settings: GridSettings,
	hasSettings: true,
	render: ({ value, content, isPreview, onNestedBlockChange }) => (
		<div className={gridClassNames(content).join(" ")} style={gridStyleVars(content) as React.CSSProperties}>
			<ContainerChildren block={value} isPreview={isPreview ?? false} stackClassName={GRID_ITEMS_CLASS} onBlockChange={onNestedBlockChange} />
		</div>
	),
});

export default GridBlock;
