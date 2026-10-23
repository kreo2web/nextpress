import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { readSearchContent } from "@shared/blocks/search-model";
import { SearchButtonView } from "@shared/blocks/search-view";
import { getRenderProps } from "../render-helpers";

/**
 * Published search button. The same markup as the editor (`SearchButtonView`); `/vendor/search.js`
 * makes it open the search window, so this renders without hooks or state.
 */
export function SearchBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	return (
		<div className={["wp-block-search", className].filter(Boolean).join(" ")} style={style} {...attributes}>
			<SearchButtonView content={readSearchContent(block.content)} />
		</div>
	);
}
