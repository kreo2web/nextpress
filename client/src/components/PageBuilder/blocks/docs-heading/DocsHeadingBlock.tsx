import React from "react";
import { Heading2 } from "lucide-react";
import { DEFAULT_DOCS_HEADING_CONTENT, readDocsHeadingContent, type DocsHeadingContent } from "@shared/blocks/docs-heading-model";
import { DocsHeadingView } from "@shared/blocks/docs-prose-views";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { DocsTextField } from "../../docs-mode/DocsTextField";
import { DocsHeadingSettings } from "./docs-heading-settings";

/** Canvas view: the same heading as the page; double-click to type in place. Enter starts a paragraph under it. */
const DocsHeadingBlock = createBlockDefinition<DocsHeadingContent>({
	...catalogMeta("docs/heading"),
	icon: Heading2,
	defaultContent: DEFAULT_DOCS_HEADING_CONTENT,
	parseContent: (raw) => readDocsHeadingContent(raw),
	settings: DocsHeadingSettings,
	hasSettings: true,
	render: ({ value, content, styles, isEditing, setContent }) => (
		<div className="wp-block-docs-heading np-prose" style={styles}>
			{isEditing ? (
				<DocsTextField
					blockId={value.id}
					field="text"
					kind="heading"
					value={content.text}
					onChange={(text) => setContent((prev) => ({ ...prev, text }))}
					placeholder="Heading text"
					ariaLabel="Heading text"
				/>
			) : (
				<DocsHeadingView level={content.level} text={content.text} anchor={content.anchor} />
			)}
		</div>
	),
});

export default DocsHeadingBlock;
