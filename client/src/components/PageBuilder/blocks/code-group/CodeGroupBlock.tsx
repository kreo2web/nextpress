import React, { useEffect, useMemo, useState } from "react";
import type { BlockConfig } from "@shared/schema-types";
import { FileCode2 } from "lucide-react";
import { DEFAULT_CODE_GROUP_CONTENT, readCodeGroupContent, type CodeGroupContent } from "@shared/blocks/code-group-model";
import { TabsListView } from "@shared/blocks/tabs-view";
import { codeGroupSyncKey, codeTabLabel } from "@shared/markdown/components/code-tab-label";
import { readCodeGroupTabs } from "@shared/markdown/components/code-group-tabs";
import { ContainerChildren } from "../../BlockRenderer";
import { useBlockActions } from "../../BlockActionsContext";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { findOwningTabId } from "../tabs/tabs-factory";
import { CodeGroupSettings } from "./code-group-settings";

type CodeGroupCanvasProps = {
	hostBlock: BlockConfig;
	isPreview?: boolean;
	onNestedBlockChange?: (updated: BlockConfig) => void;
};

/**
 * Canvas view: the page's tab bar over the code, with only the open code block shown. Which tab is
 * open is local (not saved). Selecting a block inside a closed tab, for example from the layers
 * panel, opens that tab so the block is visible.
 */
function CodeGroupCanvas({ hostBlock, isPreview, onNestedBlockChange }: CodeGroupCanvasProps) {
	const actions = useBlockActions();
	const { codes } = useMemo(() => readCodeGroupTabs(hostBlock.children ?? []), [hostBlock.children]);
	const [openId, setOpenId] = useState<string | null>(null);
	const activeId = codes.find((code) => code.block.id === openId)?.block.id ?? codes[0]?.block.id ?? null;
	const selectedIndex = Math.max(0, codes.findIndex((code) => code.block.id === activeId));

	const owningId = findOwningTabId({ tabs: codes.map((code) => code.block), blockId: actions?.selectedBlockId ?? null });
	useEffect(() => {
		if (owningId) setOpenId(owningId);
	}, [owningId]);

	const labels = codes.map(({ title, language }) => codeTabLabel({ title, language }));
	const hideClosed = (child: BlockConfig): React.CSSProperties =>
		codes.some((code) => code.block.id === child.id) && child.id !== activeId ? { display: "none" } : {};

	const choose = (index: number) => {
		const target = codes[index]?.block.id;
		if (!target) return;
		setOpenId(target);
		actions?.onSelect(target);
	};

	return (
		<div className="wp-block-tabs np-tabs--underline np-code-group">
			<TabsListView
				id={hostBlock.id}
				titles={labels}
				selected={selectedIndex}
				onSelect={choose}
				listAttributes={{ "data-np-sync": codeGroupSyncKey(labels) }}
			/>
			<ContainerChildren
				block={hostBlock}
				isPreview={isPreview ?? false}
				stackClassName="np-tabs__panels"
				itemStyle={hideClosed}
				onBlockChange={onNestedBlockChange}
			/>
		</div>
	);
}

const CodeGroupBlock = createBlockDefinition<CodeGroupContent>({
	...catalogMeta("docs/code-group"),
	icon: FileCode2,
	handlesOwnChildren: true,
	defaultContent: DEFAULT_CODE_GROUP_CONTENT,
	parseContent: (raw) => readCodeGroupContent(raw),
	settings: CodeGroupSettings,
	hasSettings: true,
	render: ({ value, isPreview, onNestedBlockChange }) => (
		<CodeGroupCanvas hostBlock={value} isPreview={isPreview} onNestedBlockChange={onNestedBlockChange} />
	),
});

export default CodeGroupBlock;
