import React from "react";
import { Type } from "lucide-react";
import { DEFAULT_DOCS_TEXT_CONTENT, readDocsTextContent, type DocsTextContent } from "@shared/blocks/docs-text-model";
import { DocsTextView } from "@shared/blocks/docs-prose-views";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { InlineTextEditor } from "../shared/inline-text-editor";
import { DocsTextSettings } from "./docs-text-settings";

/** Canvas view: the same paragraph as the page; double-click to type in place, with the paragraph's own field. */
const DocsTextBlock = createBlockDefinition<DocsTextContent>({
	...catalogMeta("docs/text"),
	icon: Type,
	defaultContent: DEFAULT_DOCS_TEXT_CONTENT,
	parseContent: (raw) => readDocsTextContent(raw),
	settings: DocsTextSettings,
	hasSettings: true,
	render: ({ content, isEditing, setContent }) => (
		<div className="wp-block-docs-text np-prose">
			{isEditing ? (
				<InlineTextEditor
					value={content.text}
					onChange={(text) => setContent((prev) => ({ ...prev, text }))}
					style={{ color: "inherit", font: "inherit", lineHeight: "inherit" }}
					multiline
					placeholder="Write a paragraph"
					ariaLabel="Paragraph text"
				/>
			) : content.text.trim() ? (
				<DocsTextView text={content.text} />
			) : (
				// An empty paragraph still shows where it is and how to start, on the canvas only.
				<p className="text-npb-text-muted">Empty paragraph. Double-click to write.</p>
			)}
		</div>
	),
});

export default DocsTextBlock;
