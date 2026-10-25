import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { TAB_BLOCK_NAME, readTabContent, readTabsContent } from "@shared/blocks/tabs-model";
import { TabsView } from "@shared/blocks/tabs-view";
import type { ViewAttributes } from "@shared/blocks/view-attributes";
import { getRenderProps, renderChildBlocks } from "../render-helpers";

/**
 * Tabs, published. The panels are drawn by the shared view (not by each Tab) so every panel knows
 * its number. `/vendor/tabs.js` switches them; without it the first tab still shows. With
 * `linkable` on, each tab button carries its link name, which the script uses for `#tab-name` links.
 */
export function TabsBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const { look, linkable } = readTabsContent(block.content);
	const children = block.children ?? [];
	const tabs = children.filter((child) => child.name === TAB_BLOCK_NAME);
	const others = children.filter((child) => child.name !== TAB_BLOCK_NAME);

	return (
		<TabsView
			id={block.id}
			look={look}
			linkable={linkable}
			className={className}
			style={style}
			attributes={attributes as ViewAttributes}
			tabs={tabs.map((tab) => {
				const props = getRenderProps(tab);
				return {
					key: tab.id,
					title: readTabContent(tab.content).title,
					className: props.className,
					style: props.style,
					attributes: props.attributes as ViewAttributes,
					panel: renderChildBlocks(tab.children ?? []),
				};
			})}
			after={others.length > 0 ? renderChildBlocks(others) : null}
		/>
	);
}
