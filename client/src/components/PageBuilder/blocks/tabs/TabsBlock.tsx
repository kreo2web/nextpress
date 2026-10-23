import React, { useEffect, useMemo, useState } from "react";
import type { BlockConfig } from "@shared/schema-types";
import { PanelTop } from "lucide-react";
import {
	DEFAULT_TABS_CONTENT,
	TAB_BLOCK_NAME,
	readTabContent,
	readTabsContent,
	tabElementIds,
	type TabsContent,
} from "@shared/blocks/tabs-model";
import { ContainerChildren } from "../../BlockRenderer";
import { useBlockActions } from "../../BlockActionsContext";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { TabsContext } from "./tabs-context";
import { TabsSettings } from "./tabs-settings";
import { findOwningTabId } from "./tabs-factory";

type TabsCanvasProps = {
	hostBlock: BlockConfig;
	content: TabsContent;
	isPreview?: boolean;
	onNestedBlockChange?: (updated: BlockConfig) => void;
};

/**
 * Canvas view: the same tab bar as the page, with only the open tab's panel shown. Which tab is
 * open is local (not saved). Selecting a block inside a closed tab, for example from the layers
 * panel, opens that tab so the block is visible.
 */
function TabsCanvas({ hostBlock, content, isPreview, onNestedBlockChange }: TabsCanvasProps) {
	const actions = useBlockActions();
	const tabs = useMemo(
		() => (hostBlock.children ?? []).filter((child) => child.name === TAB_BLOCK_NAME),
		[hostBlock.children],
	);
	const [openId, setOpenId] = useState<string | null>(null);
	const activeTabId = tabs.find((tab) => tab.id === openId)?.id ?? tabs[0]?.id ?? null;

	const owningTabId = findOwningTabId({ tabs, blockId: actions?.selectedBlockId ?? null });
	useEffect(() => {
		if (owningTabId) setOpenId(owningTabId);
	}, [owningTabId]);

	const tabIds = useMemo(() => tabs.map((tab) => tab.id), [tabs]);
	const context = useMemo(
		() => ({ tabsId: hostBlock.id, tabIds, activeTabId }),
		[hostBlock.id, tabIds, activeTabId],
	);
	const hideClosedTabs = (child: BlockConfig): React.CSSProperties =>
		child.name === TAB_BLOCK_NAME && child.id !== activeTabId ? { display: "none" } : {};

	const moveFocus = (index: number) => {
		const target = tabs[(index + tabs.length) % tabs.length];
		if (!target) return;
		setOpenId(target.id);
		document.getElementById(tabElementIds({ tabsId: hostBlock.id, index: tabs.indexOf(target) }).tab)?.focus();
	};

	return (
		<TabsContext.Provider value={context}>
			<div className={`wp-block-tabs np-tabs--${content.look}`}>
				<div className="np-tabs__list" role="tablist">
					{tabs.map((tab, index) => {
						const ids = tabElementIds({ tabsId: hostBlock.id, index });
						const selected = tab.id === activeTabId;
						return (
							<button
								key={tab.id}
								type="button"
								role="tab"
								className="np-tabs__tab"
								id={ids.tab}
								aria-controls={ids.panel}
								aria-selected={selected}
								tabIndex={selected ? 0 : -1}
								onClick={(event) => {
									event.stopPropagation();
									setOpenId(tab.id);
									actions?.onSelect(tab.id);
								}}
								onKeyDown={(event) => {
									const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
									if (step !== undefined) moveFocus(index + step);
									else if (event.key === "Home") moveFocus(0);
									else if (event.key === "End") moveFocus(tabs.length - 1);
									else return;
									event.preventDefault();
								}}
							>
								{readTabContent(tab.content).title || "Untitled tab"}
							</button>
						);
					})}
				</div>
				<ContainerChildren
					block={hostBlock}
					isPreview={isPreview ?? false}
					stackClassName="np-tabs__panels"
					itemStyle={hideClosedTabs}
					onBlockChange={onNestedBlockChange}
				/>
			</div>
		</TabsContext.Provider>
	);
}

const TabsBlock = createBlockDefinition<TabsContent>({
	...catalogMeta("core/tabs"),
	icon: PanelTop,
	handlesOwnChildren: true,
	defaultContent: DEFAULT_TABS_CONTENT,
	parseContent: (raw) => readTabsContent(raw),
	settings: TabsSettings,
	hasSettings: true,
	render: ({ value, content, isPreview, onNestedBlockChange }) => (
		<TabsCanvas hostBlock={value} content={content} isPreview={isPreview} onNestedBlockChange={onNestedBlockChange} />
	),
});

export default TabsBlock;
