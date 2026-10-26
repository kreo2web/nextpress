import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { DocsShellView } from "@shared/blocks/docs-shell-view";
import { readDocsShellBound } from "@shared/blocks/docs-shell-model";
import { getRenderProps, renderChildBlocks } from "../render-helpers";

/**
 * The docs shell, published. The top bar settings (after inheritance) and the sidebar come from
 * data bound onto the block when the page is served (`server/lib/bind-published-docs-layout.ts`).
 * `/vendor/docs.js` runs the phone drawer; `/vendor/search.js` opens search.
 */
export function DocsShellBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	return (
		<DocsShellView blockId={block.id} bound={readDocsShellBound(block.content)} className={className} style={style} attributes={attributes}>
			{renderChildBlocks(block.children ?? [])}
		</DocsShellView>
	);
}
