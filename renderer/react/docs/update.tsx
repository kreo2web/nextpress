import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { readUpdateContent } from "@shared/blocks/update-model";
import { UpdateView } from "@shared/blocks/update-view";
import { getRenderProps, renderChildBlocks } from "../render-helpers";

/** Changelog entry, published: the label column beside the entry's content. The same markup the MDX `<Update>` tag draws. */
export function UpdateBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const { label, description } = readUpdateContent(block.content);
	return (
		<div className={["wp-block-docs-update", className].filter(Boolean).join(" ")} style={style} {...attributes}>
			<UpdateView label={label} description={description}>
				{renderChildBlocks(block.children ?? [])}
			</UpdateView>
		</div>
	);
}
