import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { readCodeExampleContent } from "@shared/blocks/code-example-model";
import { CodeExampleView } from "@shared/blocks/code-example-view";
import { getRenderProps, renderChildBlocks } from "../render-helpers";

/**
 * Code example, published: the first code block child is the "Code" pane, every other child is
 * the "Result" pane. The same `CodeExampleView` draws MDX `<Example>`.
 */
export function CodeExampleBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const children = block.children ?? [];
	const code = children.find((child) => child.name === "core/code");
	return (
		<div className={["wp-block-code-example", className].filter(Boolean).join(" ")} style={style} {...attributes}>
			<CodeExampleView
				layout={readCodeExampleContent(block.content).layout}
				code={code ? renderChildBlocks([code]) : null}
				result={renderChildBlocks(children.filter((child) => child !== code))}
			/>
		</div>
	);
}
