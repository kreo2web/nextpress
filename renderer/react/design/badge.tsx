import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { readBadgeContent } from "@shared/blocks/badge-model";
import { getRenderProps } from "../render-helpers";

/**
 * Published badge. The markup matches the editor canvas exactly, so `BADGE_CSS` styles both.
 * The text-align from the block's styles sits on the wrapper; the pill inherits it.
 */
export function BadgeBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const badge = readBadgeContent(block.content);
	return (
		<div className={["wp-block-badge", className].filter(Boolean).join(" ")} style={style} {...attributes}>
			<span className={`np-badge np-badge--${badge.look}`} data-tone={badge.tone}>
				{badge.text}
			</span>
		</div>
	);
}
