import type { BlockConfig } from "@shared/schema-types";
import { getRenderProps, parseStructuredContent } from "../render-helpers";
import {
	DEFAULT_READ_MORE_TEXT,
	readExcerptMaxLength,
	readReadMoreText,
	truncateExcerpt,
} from "@shared/excerpt-display";

/**
 * Post excerpt with the saved character cap and an optional read-more link.
 */
export function PostExcerptBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const data = parseStructuredContent(block.content);
	const text =
		typeof data.text === "string" && data.text
			? data.text
			: typeof data.value === "string"
				? data.value
				: "";
	const maxLength = readExcerptMaxLength(data.maxLength);
	const showReadMore = data.showReadMore !== false;
	const readMoreText = readReadMoreText(data.readMoreText) || DEFAULT_READ_MORE_TEXT;
	const postHref = typeof data.postHref === "string" ? data.postHref.trim() : "";
	const { truncated } = truncateExcerpt({ text, maxLength });
	const mergedClassName = ["wp-block-post-excerpt", className].filter(Boolean).join(" ");

	return (
		<div className={mergedClassName || undefined} style={style} {...attributes}>
			<p className="wp-block-post-excerpt__excerpt" style={{ margin: 0 }}>
				{truncated}
			</p>
			{showReadMore && postHref ? (
				<p className="wp-block-post-excerpt__more-link" style={{ margin: "0.5em 0 0" }}>
					<a href={postHref}>{readMoreText}</a>
				</p>
			) : null}
		</div>
	);
}
