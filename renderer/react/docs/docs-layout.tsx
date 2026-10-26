import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { readDocsBound, readDocsLayoutContent } from "@shared/blocks/docs-layout-model";
import { DocsLayoutView } from "@shared/blocks/docs-layout-view";
import { getRenderProps, renderChildBlocks } from "../render-helpers";

/**
 * The docs layout, published. The sidebar, pager and "On this page" come from data bound onto the
 * block when the page is served (`server/lib/bind-published-docs-layout.ts`); without it the
 * content still shows on its own. `/vendor/docs.js` runs the phone drawer, the reading highlight
 * and Copy page.
 */
export function DocsLayoutBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	return (
		<DocsLayoutView
			blockId={block.id}
			content={readDocsLayoutContent(block.content)}
			bound={readDocsBound(block.content)}
			className={className}
			style={style}
			attributes={attributes}
		>
			{renderChildBlocks(block.children ?? [])}
		</DocsLayoutView>
	);
}
