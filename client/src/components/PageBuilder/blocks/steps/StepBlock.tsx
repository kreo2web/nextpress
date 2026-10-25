import React from "react";
import { Footprints } from "lucide-react";
import type { BlockConfig } from "@shared/schema-types";
import { DEFAULT_STEP_CONTENT, readStepContent, type StepContent } from "@shared/blocks/steps-model";
import { StepMarkerView } from "@shared/blocks/steps-view";
import { ContainerChildren } from "../../BlockRenderer";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { InlineTextEditor } from "../shared/inline-text-editor";
import { StepSettings } from "./step-settings";
import { useStepsContext } from "./steps-context";

type StepCanvasProps = {
	hostBlock: BlockConfig;
	content: StepContent;
	setContent: (next: StepContent | ((prev: StepContent) => StepContent)) => void;
	isPreview?: boolean;
	isEditing?: boolean;
	onNestedBlockChange?: (updated: BlockConfig) => void;
};

/**
 * One step on the canvas: its marker circle when the Steps use icons (the same piece the page
 * draws), the title (editable in place) and its body blocks, as published.
 */
function StepCanvas({ hostBlock, content, setContent, isPreview, isEditing, onNestedBlockChange }: StepCanvasProps) {
	const { marker } = useStepsContext();
	return (
		<div className="wp-block-step">
			{marker === "icon" ? <StepMarkerView icon={content.icon} /> : null}
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
				<ContainerChildren block={hostBlock} isPreview={isPreview ?? false} onBlockChange={onNestedBlockChange} />
			</div>
		</div>
	);
}

/** Canvas view of one step. */
const StepBlock = createBlockDefinition<StepContent>({
	...catalogMeta("core/step"),
	icon: Footprints,
	handlesOwnChildren: true,
	defaultContent: DEFAULT_STEP_CONTENT,
	parseContent: (raw) => readStepContent(raw),
	settings: StepSettings,
	hasSettings: true,
	render: ({ value, content, setContent, isPreview, isEditing, onNestedBlockChange }) => (
		<StepCanvas
			hostBlock={value}
			content={content}
			setContent={setContent}
			isPreview={isPreview}
			isEditing={isEditing}
			onNestedBlockChange={onNestedBlockChange}
		/>
	),
});

export default StepBlock;
