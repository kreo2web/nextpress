import React from "react";
import { PanelTop } from "lucide-react";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import {
	DEFAULT_HEADER_CONTENT,
	normalizeHeaderContent,
	readHeaderContent,
	type HeaderContent,
} from "@shared/header-model";
import { HeaderCanvas } from "./header-canvas";
import { HeaderSettings } from "./header-settings";

const HeaderBlock = createBlockDefinition<HeaderContent>({
	...catalogMeta("core/header"),
	icon: PanelTop,
	handlesOwnChildren: true,
	defaultContent: DEFAULT_HEADER_CONTENT,
	settings: HeaderSettings,
	hasSettings: true,
	parseContent: readHeaderContent,
	render: ({ content, value, isPreview, onNestedBlockChange }) => (
		<HeaderCanvas
			content={normalizeHeaderContent(content)}
			hostBlock={value}
			isPreview={isPreview}
			onNestedBlockChange={onNestedBlockChange}
		/>
	),
});

export default HeaderBlock;
