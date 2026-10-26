import React from "react";
import { History } from "lucide-react";
import { DEFAULT_UPDATE_CONTENT, readUpdateContent, type UpdateContent } from "@shared/blocks/update-model";
import { UpdateView } from "@shared/blocks/update-view";
import { ContainerChildren } from "../../BlockRenderer";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { UpdateSettings } from "./update-settings";

/**
 * Canvas view: the same `UpdateView` as the page, with the entry's blocks editable beside its label. The label
 * and description are edited in the settings panel.
 */
const UpdateBlock = createBlockDefinition<UpdateContent>({
	...catalogMeta("docs/update"),
	icon: History,
	handlesOwnChildren: true,
	defaultContent: DEFAULT_UPDATE_CONTENT,
	parseContent: (raw) => readUpdateContent(raw),
	settings: UpdateSettings,
	hasSettings: true,
	render: ({ value, content, styles, isPreview, onNestedBlockChange }) => (
		<div className="wp-block-docs-update" style={styles}>
			<UpdateView label={content.label} description={content.description}>
				<ContainerChildren block={value} isPreview={isPreview ?? false} onBlockChange={onNestedBlockChange} />
			</UpdateView>
		</div>
	),
});

export default UpdateBlock;
