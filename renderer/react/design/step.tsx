import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { readStepContent } from "@shared/blocks/steps-model";
import { StepItemView } from "@shared/blocks/steps-view";
import type { ViewAttributes } from "@shared/blocks/view-attributes";
import { getRenderProps, renderChildBlocks } from "../render-helpers";

/**
 * One step. Steps draws its children as list items; a step found anywhere else (moved by hand,
 * or placed from the API) keeps the same classes on a plain div, so it still looks like a step.
 * `showIcon` is on when the Steps use the "icon" marker: only then is the step's icon drawn.
 */
export function StepView({ block, as, showIcon = false }: { block: BlockConfig; as: "li" | "div"; showIcon?: boolean }): React.ReactElement {
	const { style, className, attributes } = getRenderProps(block);
	const { title, icon } = readStepContent(block.content);
	return (
		<StepItemView as={as} title={title} icon={showIcon ? icon : undefined} className={className} style={style} attributes={attributes as ViewAttributes}>
			{renderChildBlocks(block.children ?? [])}
		</StepItemView>
	);
}

/** Step Block Component: the misplaced case, a div. */
export function StepBlock(block: BlockConfig) {
	return <StepView block={block} as="div" />;
}
