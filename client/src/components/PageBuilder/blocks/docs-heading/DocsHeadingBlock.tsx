import React from "react";
import { Heading2 } from "lucide-react";
import { DEFAULT_DOCS_HEADING_CONTENT, readDocsHeadingContent, type DocsHeadingContent } from "@shared/blocks/docs-heading-model";
import { DocsHeadingView } from "@shared/blocks/docs-prose-views";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { InlineTextEditor } from "../shared/inline-text-editor";
import { DocsHeadingSettings } from "./docs-heading-settings";

/** Canvas view: the same heading as the page; double-click to type in place. */
const DocsHeadingBlock = createBlockDefinition<DocsHeadingContent>({
	...catalogMeta("docs/heading"),
	icon: Heading2,
	defaultContent: DEFAULT_DOCS_HEADING_CONTENT,
	parseContent: (raw) => readDocsHeadingContent(raw),
	settings: DocsHeadingSettings,
	hasSettings: true,
	render: ({ content, isEditing, setContent }) => (
		<div className="wp-block-docs-heading np-prose">
			{isEditing ? (
				<InlineTextEditor
					value={content.text}
					onChange={(text) => setContent((prev) => ({ ...prev, text }))}
					style={{ color: "inherit", font: "inherit", lineHeight: "inherit" }}
					placeholder="Heading text"
					ariaLabel="Heading text"
					growToWrap
				/>
			) : (
				<DocsHeadingView level={content.level} text={content.text} anchor={content.anchor} />
			)}
		</div>
	),
});

export default DocsHeadingBlock;
