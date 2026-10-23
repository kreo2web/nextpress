import React from "react";
import { Footprints } from "lucide-react";
import { DEFAULT_STEP_CONTENT, readStepContent, type StepContent } from "@shared/blocks/steps-model";
import { ContainerChildren } from "../../BlockRenderer";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { InlineTextEditor } from "../shared/inline-text-editor";
import { StepSettings } from "./step-settings";

/** Canvas view of one step: the title (editable in place) and its body blocks, as published. */
const StepBlock = createBlockDefinition<StepContent>({
	...catalogMeta("core/step"),
	icon: Footprints,
	handlesOwnChildren: true,
	defaultContent: DEFAULT_STEP_CONTENT,
	parseContent: (raw) => readStepContent(raw),
	settings: StepSettings,
	hasSettings: true,
	render: ({ value, content, setContent, isPreview, isEditing, onNestedBlockChange }) => (
		<div className="wp-block-step">
			<h3 className="np-step__title">
				{isEditing ? (
					<InlineTextEditor
						value={content.title}
						onChange={(title) => setContent((prev) => ({ ...prev, title }))}
						placeholder="Step title"
						ariaLabel="Step title"
					/>
				) : (
					content.title || "Untitled step"
				)}
			</h3>
			<div className="np-step__body">
				<ContainerChildren block={value} isPreview={isPreview ?? false} onBlockChange={onNestedBlockChange} />
			</div>
		</div>
	),
});

export default StepBlock;
