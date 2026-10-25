import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { STEP_BLOCK_NAME, readStepsContent } from "@shared/blocks/steps-model";
import { StepsOtherView, StepsView } from "@shared/blocks/steps-view";
import type { ViewAttributes } from "@shared/blocks/view-attributes";
import { getRenderProps, renderChildBlocks } from "../render-helpers";
import { StepView } from "./step";

/**
 * Steps Block Component: an ordered list whose items are its `core/step` children. Numbers and
 * connector lines or arrows come from `STEPS_CSS`, so nothing here counts. Only the "icon"
 * marker needs markup: each step then draws its own icon.
 */
export function StepsBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const { layout, marker } = readStepsContent(block.content);
	return (
		<StepsView layout={layout} marker={marker} className={className} style={style} attributes={attributes as ViewAttributes}>
			{(block.children ?? []).map((child) =>
				child.name === STEP_BLOCK_NAME ? (
					<StepView key={child.id} block={child} as="li" showIcon={marker === "icon"} />
				) : (
					<StepsOtherView key={child.id}>{renderChildBlocks([child])}</StepsOtherView>
				),
			)}
		</StepsView>
	);
}
