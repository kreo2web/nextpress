import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { GRID_ITEMS_CLASS, gridStyleVars, readGridContent } from "@shared/blocks/grid-model";
import { getRenderProps, renderChildBlocks } from "../render-helpers";

/** Published grid: same outer element and item wrapper as the canvas, sized by inline CSS variables. */
export function GridBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const content = readGridContent(block.content);
	const classes = ["wp-block-grid", content.minItemWidth ? "has-min-width" : "", className].filter(Boolean).join(" ");
	return (
		<div className={classes} style={{ ...style, ...gridStyleVars(content) }} {...attributes}>
			<div className={GRID_ITEMS_CLASS}>{renderChildBlocks(block.children ?? [])}</div>
		</div>
	);
}
