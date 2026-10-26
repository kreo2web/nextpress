import React from "react";
import { SquareCode } from "lucide-react";
import { DEFAULT_CODE_EXAMPLE_CONTENT, readCodeExampleContent, type CodeExampleContent } from "@shared/blocks/code-example-model";
import { ContainerChildren } from "../../BlockRenderer";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { CodeExampleSettings } from "./code-example-settings";

/**
 * Canvas view: one stack of ordinary blocks, so each stays editable and draggable. The first child
 * is the code and the rest the result; labels mark the two. The published page lays them out
 * side by side or stacked, as the layout setting says.
 */
const CodeExampleBlock = createBlockDefinition<CodeExampleContent>({
	...catalogMeta("docs/example"),
	icon: SquareCode,
	handlesOwnChildren: true,
	defaultContent: DEFAULT_CODE_EXAMPLE_CONTENT,
	parseContent: (raw) => readCodeExampleContent(raw),
	settings: CodeExampleSettings,
	hasSettings: true,
	render: ({ value, content, styles, isPreview, onNestedBlockChange }) => (
		<div className="wp-block-code-example np-example np-example--canvas" data-layout={content.layout} style={styles}>
			<ContainerChildren block={value} isPreview={isPreview ?? false} onBlockChange={onNestedBlockChange} stackClassName="np-example-stack" />
		</div>
	),
});

export default CodeExampleBlock;
