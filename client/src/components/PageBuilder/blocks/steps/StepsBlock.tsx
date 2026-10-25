import React, { useMemo } from "react";
import type { BlockConfig } from "@shared/schema-types";
import { ListOrdered } from "lucide-react";
import { DEFAULT_STEPS_CONTENT, readStepsContent, type StepsContent } from "@shared/blocks/steps-model";
import { ContainerChildren } from "../../BlockRenderer";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { StepsContext } from "./steps-context";
import { StepsSettings } from "./steps-settings";

type StepsCanvasProps = {
	hostBlock: BlockConfig;
	content: StepsContent;
	isPreview?: boolean;
	onNestedBlockChange?: (updated: BlockConfig) => void;
};

/**
 * Canvas view: the steps are ordinary child blocks (select, drag, reorder like any block). Same
 * classes as the published page, so `STEPS_CSS` styles both and numbers follow the order. The
 * marker goes down to each step through context, so a step draws its icon only for "icon".
 */
function StepsCanvas({ hostBlock, content, isPreview, onNestedBlockChange }: StepsCanvasProps) {
	const context = useMemo(() => ({ marker: content.marker }), [content.marker]);
	return (
		<StepsContext.Provider value={context}>
			<div className={`wp-block-steps np-steps--${content.layout} np-steps--${content.marker}`}>
				<ContainerChildren
					block={hostBlock}
					isPreview={isPreview ?? false}
					stackClassName="np-steps__items"
					onBlockChange={onNestedBlockChange}
				/>
			</div>
		</StepsContext.Provider>
	);
}

const StepsBlock = createBlockDefinition<StepsContent>({
	...catalogMeta("core/steps"),
	icon: ListOrdered,
	handlesOwnChildren: true,
	defaultContent: DEFAULT_STEPS_CONTENT,
	parseContent: (raw) => readStepsContent(raw),
	settings: StepsSettings,
	hasSettings: true,
	render: ({ value, content, isPreview, onNestedBlockChange }) => (
		<StepsCanvas hostBlock={value} content={content} isPreview={isPreview} onNestedBlockChange={onNestedBlockChange} />
	),
});

export default StepsBlock;
