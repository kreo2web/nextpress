import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { readCardContent } from "@shared/blocks/card-model";
import { CardView } from "@shared/blocks/card-view";
import type { ViewAttributes } from "@shared/blocks/view-attributes";
import { getRenderProps, renderChildBlocks } from "../render-helpers";

/** Published card; the markup is shared with the MDX `<Card>` tag (see `card-view.tsx`). */
export function CardBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	return (
		<CardView content={readCardContent(block.content)} className={className} style={style} attributes={attributes as ViewAttributes}>
			{renderChildBlocks(block.children ?? [])}
		</CardView>
	);
}
