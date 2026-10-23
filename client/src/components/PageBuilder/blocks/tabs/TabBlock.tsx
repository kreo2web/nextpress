import React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { RectangleHorizontal } from "lucide-react";
import { DEFAULT_TAB_CONTENT, readTabContent, tabElementIds, type TabContent } from "@shared/blocks/tabs-model";
import { ContainerChildren } from "../../BlockRenderer";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { useTabsContext } from "./tabs-context";
import { TabSettings } from "./tab-settings";

type TabCanvasProps = {
	hostBlock: BlockConfig;
	isPreview?: boolean;
	onNestedBlockChange?: (updated: BlockConfig) => void;
};

/**
 * One tab's panel on the canvas. Tabs hides the panels that are not open (on the wrapper
 * around this block), so this only needs the ids that tie it to its tab button.
 */
function TabCanvas({ hostBlock, isPreview, onNestedBlockChange }: TabCanvasProps) {
	const { tabsId, tabIds, activeTabId } = useTabsContext();
	const index = tabIds.indexOf(hostBlock.id);
	const ids = index >= 0 ? tabElementIds({ tabsId, index }) : null;
	return (
		<div
			className="wp-block-tab"
			{...(ids ? { role: "tabpanel", id: ids.panel, "aria-labelledby": ids.tab } : {})}
			hidden={ids ? hostBlock.id !== activeTabId : false}
		>
			<ContainerChildren block={hostBlock} isPreview={isPreview ?? false} onBlockChange={onNestedBlockChange} />
		</div>
	);
}

const TabBlock = createBlockDefinition<TabContent>({
	...catalogMeta("core/tab"),
	icon: RectangleHorizontal,
	handlesOwnChildren: true,
	defaultContent: DEFAULT_TAB_CONTENT,
	parseContent: (raw) => readTabContent(raw),
	settings: TabSettings,
	hasSettings: true,
	render: ({ value, isPreview, onNestedBlockChange }) => (
		<TabCanvas hostBlock={value} isPreview={isPreview} onNestedBlockChange={onNestedBlockChange} />
	),
});

export default TabBlock;
