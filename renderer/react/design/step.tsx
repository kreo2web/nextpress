import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { readStepContent } from "@shared/blocks/steps-model";
import { getRenderProps, renderChildBlocks } from "../render-helpers";

/**
 * One step. Steps draws its children as list items; a step found anywhere else (moved by hand,
 * or placed from the API) keeps the same classes on a plain div, so it still looks like a step.
 */
export function StepView({ block, as }: { block: BlockConfig; as: "li" | "div" }): React.ReactElement {
	const { style, className, attributes } = getRenderProps(block);
	const { title } = readStepContent(block.content);
	const Tag = as;
	return (
		<Tag className={["wp-block-step", className].filter(Boolean).join(" ")} style={style} {...attributes}>
			<h3 className="np-step__title">{title}</h3>
			<div className="np-step__body">{renderChildBlocks(block.children ?? [])}</div>
		</Tag>
	);
}

/** Step Block Component: the misplaced case, a div. */
export function StepBlock(block: BlockConfig) {
	return <StepView block={block} as="div" />;
}
