import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { MarkdownView } from "@shared/markdown";
import { getRenderProps, parseMarkdownContent } from "../render-helpers";

/**
 * Markdown output for preview and published SPA pages. Same renderer as the server and the editor;
 * diagrams load in the browser only when the page has one.
 */
export function MarkdownBlock(block: BlockConfig) {
	const { style, className } = getRenderProps(block);
	const { content, mdx } = parseMarkdownContent(block.content);
	const blockClass = ["wp-block-markdown", className].filter(Boolean).join(" ");

	return (
		<div className={blockClass} style={{ color: "var(--npb-text-primary)", ...style }}>
			<MarkdownView text={content} mdx={mdx} />
		</div>
	);
}
