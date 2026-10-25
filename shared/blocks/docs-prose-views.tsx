import type { JSX } from "react";
import { InlineMarkdown } from "../markdown/inline-markdown.js";
import { type DocsHeadingContent } from "./docs-heading-model.js";
import { docsHeadingAnchor } from "./docs-heading-id.js";
import { type DocsListContent, type DocsListSubItem, shownListItems } from "./docs-list-model.js";

const HEADING_TAGS = { 2: "h2", 3: "h3", 4: "h4" } as const;

/**
 * A docs heading: the tag for its level, an id from its words, and a "#" link to itself that only
 * shows on hover or keyboard focus. Type sizes come from `.np-prose`, not from the block.
 */
export function DocsHeadingView({ level, text, anchor }: DocsHeadingContent): JSX.Element {
	const Tag = HEADING_TAGS[level];
	const id = docsHeadingAnchor({ text, anchor });
	return (
		<Tag id={id} className="np-doc-heading">
			<InlineMarkdown source={text} />
			<a className="np-heading-anchor" href={`#${id}`} aria-label="Link to this section">
				#
			</a>
		</Tag>
	);
}

/** A docs paragraph: inline markdown in one `<p>`. */
export function DocsTextView({ text }: { text: string }): JSX.Element {
	return (
		<p>
			<InlineMarkdown source={text} />
		</p>
	);
}

const ItemText = ({ item, check }: { item: DocsListSubItem; check: boolean }): JSX.Element => (
	<>
		{check ? <input type="checkbox" checked={item.checked} disabled readOnly aria-label={item.checked ? "Done" : "Not done"} /> : null}
		<InlineMarkdown source={item.text} />
	</>
);

/** A docs list: `<ul>` or `<ol>`, checklist items with a read-only box, one nested level. */
export function DocsListView({ style, items }: DocsListContent): JSX.Element {
	const List = style === "number" ? "ol" : "ul";
	const check = style === "check";
	return (
		<List className={check ? "np-doc-checklist" : undefined}>
			{shownListItems(items).map((item, index) => (
				<li key={index}>
					<ItemText item={item} check={check} />
					{item.children.length > 0 ? (
						<List>
							{item.children.map((child, childIndex) => (
								<li key={childIndex}>
									<ItemText item={child} check={check} />
								</li>
							))}
						</List>
					) : null}
				</li>
			))}
		</List>
	);
}
