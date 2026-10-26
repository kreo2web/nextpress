import React from "react";
import { MessageSquareWarning } from "lucide-react";
import { DEFAULT_CALLOUT_CONTENT, readCalloutContent, type CalloutContent } from "@shared/blocks/callout-model";
import { Callout } from "@shared/markdown/callout";
import { ContainerChildren } from "../../BlockRenderer";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { CalloutSettings } from "./callout-settings";

/** Canvas view: the same `Callout` as the page, with the child blocks editable inside its body. */
const CalloutBlock = createBlockDefinition<CalloutContent>({
	...catalogMeta("docs/callout"),
	icon: MessageSquareWarning,
	handlesOwnChildren: true,
	defaultContent: DEFAULT_CALLOUT_CONTENT,
	parseContent: (raw) => readCalloutContent(raw),
	settings: CalloutSettings,
	hasSettings: true,
	render: ({ value, content, styles, isPreview, onNestedBlockChange }) => (
		<div className="wp-block-callout" style={styles}>
			<Callout type={content.type} title={content.title}>
				<ContainerChildren block={value} isPreview={isPreview ?? false} onBlockChange={onNestedBlockChange} />
			</Callout>
		</div>
	),
});

export default CalloutBlock;
