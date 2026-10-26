import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { readParamsContent } from "@shared/blocks/params-model";
import { ParamsListView } from "@shared/blocks/params-list-view";
import { getRenderProps } from "../render-helpers";

/** Parameters, published: the same item markup as MDX `<Param>`, descriptions as small markdown. */
export function ParamsBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	return (
		<div className={["wp-block-params", className].filter(Boolean).join(" ")} style={style} {...attributes}>
			<ParamsListView items={readParamsContent(block.content).items} />
		</div>
	);
}
