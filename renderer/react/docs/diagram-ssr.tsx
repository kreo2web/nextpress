import * as React from "react";
import { render as renderMermaid } from "pele";
import type { BlockConfig } from "@shared/schema-types";
import { readDiagramContent } from "@shared/blocks/diagram-model";
import { DIAGRAM_RENDER_OPTIONS, DiagramView } from "@shared/markdown";
import { getRenderProps } from "../render-helpers";

/** Draws the diagram on the server, the way markdown fences are drawn (`MarkdownSsrBlock`). Server only: Pele's full bundle stays out of the SPA. */
const renderDiagram = (source: string): string => renderMermaid(source, DIAGRAM_RENDER_OPTIONS).svg;

/**
 * Diagram, published: the picture is drawn when the page is rendered, so the visitor gets an SVG and no
 * diagram code. A diagram that can't be drawn shows the plain message instead (see `DiagramView`).
 */
export function DiagramSsrBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const { code, caption } = readDiagramContent(block.content);
	return (
		<div className={["wp-block-docs-diagram", className].filter(Boolean).join(" ")} style={style} {...attributes}>
			<DiagramView source={code} caption={caption} render={renderDiagram} />
		</div>
	);
}
