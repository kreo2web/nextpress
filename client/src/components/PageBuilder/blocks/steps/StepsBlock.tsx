import React from "react";
import { ListOrdered } from "lucide-react";
import { DEFAULT_STEPS_CONTENT, readStepsContent, type StepsContent } from "@shared/blocks/steps-model";
import { ContainerChildren } from "../../BlockRenderer";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { StepsSettings } from "./steps-settings";

/**
 * Canvas view: the steps are ordinary child blocks (select, drag, reorder like any block). Same
 * classes as the published page, so `STEPS_CSS` styles both and numbers follow the order.
 */
const StepsBlock = createBlockDefinition<StepsContent>({
	...catalogMeta("core/steps"),
	icon: ListOrdered,
	handlesOwnChildren: true,
	defaultContent: DEFAULT_STEPS_CONTENT,
	parseContent: (raw) => readStepsContent(raw),
	settings: StepsSettings,
	hasSettings: true,
	render: ({ value, content, isPreview, onNestedBlockChange }) => (
		<div className={`wp-block-steps np-steps--${content.layout} np-steps--${content.marker}`}>
			<ContainerChildren
				block={value}
				isPreview={isPreview ?? false}
				stackClassName="np-steps__items"
				onBlockChange={onNestedBlockChange}
			/>
		</div>
	),
});

export default StepsBlock;
