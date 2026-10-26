import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { readDiagramContent } from "@shared/blocks/diagram-model";
import { DiagramView } from "@shared/markdown/diagram-view";
import { getRenderProps } from "../render-helpers";

/**
 * Diagram, drawn in the browser: the Mermaid text as Pele draws it, loaded only when a page has a diagram.
 * Published pages are drawn on the server instead (`diagram-ssr.tsx`), so this is what the SPA shows.
 */
export function DiagramBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const { code, caption } = readDiagramContent(block.content);
	return (
		<div className={["wp-block-docs-diagram", className].filter(Boolean).join(" ")} style={style} {...attributes}>
			<DiagramView source={code} caption={caption} />
		</div>
	);
}
