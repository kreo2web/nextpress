import { LayoutPanelTop } from "lucide-react";
import { TEMPLATE_PART_BLOCK_NAME, type TemplatePartContent } from "@shared/template-parts";
import { createBlockDefinition } from "../createBlockDefinition";
import { TemplatePartFrame } from "./template-part-frame";
import { TemplatePartSettings } from "./template-part-settings";

const DEFAULT_CONTENT: TemplatePartContent = { templateId: "" };

/**
 * `core/template-part`: a linked template shown on the page. The page stores only the template id,
 * so the published page always shows the template's current blocks. See shared/template-parts.
 */
const TemplatePartBlock = createBlockDefinition<TemplatePartContent>({
	id: TEMPLATE_PART_BLOCK_NAME,
	label: "Template",
	icon: LayoutPanelTop,
	description: "Shows a template that stays linked to this page",
	category: "layout",
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
