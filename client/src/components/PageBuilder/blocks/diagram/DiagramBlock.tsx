import React from "react";
import { Workflow } from "lucide-react";
import { DEFAULT_DIAGRAM_CONTENT, readDiagramContent, type DiagramContent } from "@shared/blocks/diagram-model";
import { DiagramView } from "@shared/markdown/diagram-view";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { DiagramSettings } from "./diagram-settings";

/**
 * Canvas view: the diagram drawn live, with the same `DiagramView` the page uses (the browser loads Pele for
 * it). The Mermaid text and the caption are edited in the settings panel.
 */
const DiagramBlock = createBlockDefinition<DiagramContent>({
	...catalogMeta("docs/diagram"),
	icon: Workflow,
	defaultContent: DEFAULT_DIAGRAM_CONTENT,
	parseContent: (raw) => readDiagramContent(raw),
	settings: DiagramSettings,
	hasSettings: true,
	render: ({ content }) => (
		<div className="wp-block-docs-diagram">
			<DiagramView source={content.code} caption={content.caption} />
		</div>
	),
});

export default DiagramBlock;
