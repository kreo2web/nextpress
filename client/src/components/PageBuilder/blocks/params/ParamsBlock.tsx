import React from "react";
import { ListTree } from "lucide-react";
import { DEFAULT_PARAMS_CONTENT, readParamsContent, type ParamsContent } from "@shared/blocks/params-model";
import { ParamsListView } from "@shared/blocks/params-list-view";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { ParamsSettings } from "./params-settings";

/** Canvas view: the same list as the page. The parameters are edited in the settings panel. */
const ParamsBlock = createBlockDefinition<ParamsContent>({
	...catalogMeta("docs/params"),
	icon: ListTree,
	defaultContent: DEFAULT_PARAMS_CONTENT,
	parseContent: (raw) => readParamsContent(raw),
	settings: ParamsSettings,
	hasSettings: true,
	render: ({ content, styles }) => (
		<div className="wp-block-params" style={styles}>
			<ParamsListView items={content.items} />
		</div>
	),
});

export default ParamsBlock;
