import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { readGridContent } from "@shared/blocks/grid-model";
import { GridView } from "@shared/blocks/card-view";
import type { ViewAttributes } from "@shared/blocks/view-attributes";
import { getRenderProps, renderChildBlocks } from "../render-helpers";

/** Published grid: same outer element and item wrapper as the canvas, sized by inline CSS variables. */
export function GridBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	return (
		<GridView content={readGridContent(block.content)} className={className} style={style} attributes={attributes as ViewAttributes}>
			{renderChildBlocks(block.children ?? [])}
		</GridView>
	);
}
