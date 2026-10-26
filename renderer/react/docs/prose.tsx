import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { readDocsHeadingContent } from "@shared/blocks/docs-heading-model";
import { readDocsListContent } from "@shared/blocks/docs-list-model";
import { DocsHeadingView, DocsListView, DocsTextView } from "@shared/blocks/docs-prose-views";
import { readDocsTextContent } from "@shared/blocks/docs-text-model";
import { getRenderProps } from "../render-helpers";

const wrapperClass = ({ name, className }: { name: string; className: string }): string => [`wp-block-docs-${name}`, "np-prose", className].filter(Boolean).join(" ");

/** Heading, published: the same heading and "#" link as the editor, with the page's prose type. */
export function DocsHeadingBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	return (
		<div className={wrapperClass({ name: "heading", className })} style={style} {...attributes}>
			<DocsHeadingView {...readDocsHeadingContent(block.content)} />
		</div>
	);
}

/** Text, published: one paragraph with inline bold, italic, code and links. */
export function DocsTextBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	return (
		<div className={wrapperClass({ name: "text", className })} style={style} {...attributes}>
			<DocsTextView {...readDocsTextContent(block.content)} />
		</div>
	);
}

/** List, published: bullets, numbers or a checklist, one nested level. */
export function DocsListBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	return (
		<div className={wrapperClass({ name: "list", className })} style={style} {...attributes}>
			<DocsListView {...readDocsListContent(block.content)} />
		</div>
	);
}
