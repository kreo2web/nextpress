import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { TAB_BLOCK_NAME, readTabContent, readTabsContent, tabElementIds } from "@shared/blocks/tabs-model";
import { getRenderProps, renderChildBlocks } from "../render-helpers";

/**
 * Tabs, published. The panels are drawn here (not by each Tab) so every panel knows its number.
 * `/vendor/tabs.js` switches them; without it the first tab still shows.
 */
export function TabsBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const { look } = readTabsContent(block.content);
	const children = block.children ?? [];
	const tabs = children.filter((child) => child.name === TAB_BLOCK_NAME);
	const others = children.filter((child) => child.name !== TAB_BLOCK_NAME);

	return (
		<div
			className={["wp-block-tabs", `np-tabs--${look}`, className].filter(Boolean).join(" ")}
			style={style}
			{...attributes}
			data-np-tabs=""
		>
			<div className="np-tabs__list" role="tablist">
				{tabs.map((tab, index) => {
					const ids = tabElementIds({ tabsId: block.id, index });
					return (
						<button
							key={tab.id}
							type="button"
							role="tab"
							className="np-tabs__tab"
							id={ids.tab}
							aria-controls={ids.panel}
							aria-selected={index === 0}
							tabIndex={index === 0 ? 0 : -1}
						>
							{readTabContent(tab.content).title}
						</button>
					);
				})}
			</div>
			<div className="np-tabs__panels">
				{tabs.map((tab, index) => {
					const ids = tabElementIds({ tabsId: block.id, index });
					const props = getRenderProps(tab);
					return (
						<div
							key={tab.id}
							className={["wp-block-tab", props.className].filter(Boolean).join(" ")}
							style={props.style}
							{...props.attributes}
							role="tabpanel"
							id={ids.panel}
							aria-labelledby={ids.tab}
							tabIndex={0}
							hidden={index !== 0}
						>
							{renderChildBlocks(tab.children ?? [])}
						</div>
					);
				})}
				{others.length > 0 ? renderChildBlocks(others) : null}
			</div>
		</div>
	);
}
