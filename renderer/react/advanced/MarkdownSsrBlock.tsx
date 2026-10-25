import * as React from "react";
import { render as renderMermaid } from "pele";
import type { BlockConfig } from "@shared/schema-types";
import { DIAGRAM_RENDER_OPTIONS, MarkdownView } from "@shared/markdown";
import { getRenderProps, parseMarkdownContent } from "../render-helpers";

/** Draws Mermaid on the server, so published pages arrive with their diagrams and load no diagram code. */
const renderDiagram = (source: string): string => renderMermaid(source, DIAGRAM_RENDER_OPTIONS).svg;

/**
 * Markdown for `renderBlocksToHtml` (published pages, rendered on the server): code arrives
 * colored and diagrams drawn. Server only: Pele's full bundle must stay out of the SPA, which
 * uses `MarkdownBlock` and loads diagrams on demand.
 */
export function MarkdownSsrBlock(block: BlockConfig) {
	const { style, className } = getRenderProps(block);
	const { content, mdx } = parseMarkdownContent(block.content);
	const blockClass = ["wp-block-markdown", className].filter(Boolean).join(" ");

	return (
		<div className={blockClass} style={{ color: "var(--npb-text-primary)", ...style }}>
			<MarkdownView text={content} mdx={mdx} renderDiagram={renderDiagram} idPrefix={block.id} />
		</div>
	);
}
