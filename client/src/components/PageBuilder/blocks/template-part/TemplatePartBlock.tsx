import { LayoutPanelTop } from "lucide-react";
import type { TemplatePartContent } from "@shared/template-parts";
import { TEMPLATE_PART_DEFAULT_CONTENT } from "@shared/block-catalog/layout-blocks";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { TemplatePartFrame } from "./template-part-frame";
import { TemplatePartSettings } from "./template-part-settings";

const DEFAULT_CONTENT: TemplatePartContent = TEMPLATE_PART_DEFAULT_CONTENT;

/**
 * `core/template-part`: a linked template shown on the page. The page stores only the template id,
 * so the published page always shows the template's current blocks. See shared/template-parts.
 */
const TemplatePartBlock = createBlockDefinition<TemplatePartContent>({
	...catalogMeta("core/template-part"),
	icon: LayoutPanelTop,
	defaultContent: DEFAULT_CONTENT,
	hasSettings: true,
	settings: TemplatePartSettings,
	render: ({ value, content, isPreview }) => (
		<TemplatePartFrame
			blockId={value.id}
			parentId={value.parentId}
			templateId={content?.templateId ?? ""}
			isPreview={Boolean(isPreview)}
		/>
	),
});

export default TemplatePartBlock;
