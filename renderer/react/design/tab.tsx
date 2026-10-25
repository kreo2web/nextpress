import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { TabPanelView } from "@shared/blocks/tabs-view";
import type { ViewAttributes } from "@shared/blocks/view-attributes";
import { getRenderProps, renderChildBlocks } from "../render-helpers";

/**
 * A Tab outside Tabs (moved by hand, or from the API) has no tab bar to open it, so it shows
 * as a plain section instead of disappearing. Inside Tabs, `TabsBlock` draws the panel itself.
 */
export function TabBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	return (
		<TabPanelView className={className} style={style} attributes={attributes as ViewAttributes}>
			{renderChildBlocks(block.children ?? [])}
		</TabPanelView>
	);
}
