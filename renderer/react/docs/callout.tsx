import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { readCalloutContent } from "@shared/blocks/callout-model";
import { Callout } from "@shared/markdown/callout";
import { getRenderProps, renderChildBlocks } from "../render-helpers";

/**
 * Callout, published: the same `Callout` as MDX `<Callout>`, with the child blocks inside its
 * body. The outer box carries the block's own spacing and settings.
 */
export function CalloutBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const { type, title } = readCalloutContent(block.content);
	return (
		<div className={["wp-block-callout", className].filter(Boolean).join(" ")} style={style} {...attributes}>
			<Callout type={type} title={title}>
				{renderChildBlocks(block.children ?? [])}
			</Callout>
		</div>
	);
}
