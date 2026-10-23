import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { STEP_BLOCK_NAME, readStepsContent } from "@shared/blocks/steps-model";
import { getRenderProps, renderChildBlocks } from "../render-helpers";
import { StepView } from "./step";

/**
 * Steps Block Component: an ordered list whose items are its `core/step` children. Numbers and
 * connector lines come from `STEPS_CSS`, so nothing here counts.
 */
export function StepsBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const { layout, marker } = readStepsContent(block.content);
	return (
		<div
			className={["wp-block-steps", `np-steps--${layout}`, `np-steps--${marker}`, className].filter(Boolean).join(" ")}
			style={style}
			{...attributes}
		>
			<ol className="np-steps__items">
				{(block.children ?? []).map((child) =>
					child.name === STEP_BLOCK_NAME ? (
						<StepView key={child.id} block={child} as="li" />
					) : (
						// Any other block dropped in still shows, in its place.
						<li key={child.id} className="np-steps__other" style={{ listStyle: "none" }}>
							{renderChildBlocks([child])}
						</li>
					),
				)}
			</ol>
		</div>
	);
}
