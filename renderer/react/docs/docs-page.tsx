import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { DocsPageView } from "@shared/blocks/docs-page-view";
import { readDocsPageBound, readDocsPageContent } from "@shared/blocks/docs-page-model";
import { getRenderProps, renderChildBlocks } from "../render-helpers";

/** One docs page, published: the same view as the editor canvas, with data bound when the page is served. */
export function DocsPageBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	return (
		<DocsPageView content={readDocsPageContent(block.content)} bound={readDocsPageBound(block.content)} className={className} style={style} attributes={attributes}>
			{renderChildBlocks(block.children ?? [])}
		</DocsPageView>
	);
}
