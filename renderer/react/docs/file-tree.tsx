import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { readFileTreeContent } from "@shared/blocks/file-tree-model";
import { FileTreeView } from "@shared/blocks/file-tree-view";
import { getRenderProps } from "../render-helpers";

/** File tree, published: the same `FileTreeView` the editor and MDX `<FileTree>` draw. */
export function FileTreeBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	return (
		<div className={["wp-block-file-tree", className].filter(Boolean).join(" ")} style={style} {...attributes}>
			<FileTreeView tree={readFileTreeContent(block.content).tree} />
		</div>
	);
}
