import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { CARD_BODY_CLASS, readCardContent } from "@shared/blocks/card-model";
import { getRenderProps, renderChildBlocks } from "../render-helpers";

/**
 * Published card. A link is an overlay anchor beside the body, not around it, so buttons and
 * links inside the card stay valid (an anchor never nests in an anchor).
 */
export function CardBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const content = readCardContent(block.content);
	const classes = ["wp-block-card", `np-card--${content.look}`, content.link ? "is-linked" : "", className].filter(Boolean).join(" ");
	const newTab = content.linkTarget === "_blank";
	return (
		<div className={classes} style={style} {...attributes}>
			{content.link ? (
				<a
					className="np-card__link"
					href={content.link}
					aria-label={content.linkLabel || "Open"}
					target={newTab ? "_blank" : undefined}
					rel={newTab ? "noopener noreferrer" : undefined}
				/>
			) : null}
			<div className={CARD_BODY_CLASS}>{renderChildBlocks(block.children ?? [])}</div>
		</div>
	);
}
