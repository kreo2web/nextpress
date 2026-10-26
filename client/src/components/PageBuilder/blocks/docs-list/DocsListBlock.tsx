import React from "react";
import { List } from "lucide-react";
import { DEFAULT_DOCS_LIST_CONTENT, listFromLines, listToLines, readDocsListContent, type DocsListContent } from "@shared/blocks/docs-list-model";
import { DocsListView } from "@shared/blocks/docs-prose-views";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { InlineTextEditor } from "../shared/inline-text-editor";
import { DocsListSettings } from "./docs-list-settings";

/** Canvas view: the same list as the page; double-click to type the items in place, one per line. */
const DocsListBlock = createBlockDefinition<DocsListContent>({
	...catalogMeta("docs/list"),
	icon: List,
	defaultContent: DEFAULT_DOCS_LIST_CONTENT,
	parseContent: (raw) => readDocsListContent(raw),
	settings: DocsListSettings,
	hasSettings: true,
	render: ({ content, styles, isEditing, setContent }) => (
		<div className="wp-block-docs-list np-prose" style={styles}>
			{isEditing ? (
				<InlineTextEditor
					value={listToLines(content)}
					onChange={(lines) => setContent((prev) => ({ ...prev, items: listFromLines({ style: prev.style, lines }) }))}
					style={{ color: "inherit", font: "inherit", lineHeight: "inherit" }}
					multiline
					placeholder={"First point\nSecond point\n  A detail under it"}
					ariaLabel="List items, one per line"
				/>
			) : (
				<DocsListView style={content.style} items={content.items} />
			)}
		</div>
	),
});

export default DocsListBlock;
