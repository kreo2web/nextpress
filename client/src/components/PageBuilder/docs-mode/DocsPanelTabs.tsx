import type { ReactElement } from "react";
import { TabsContent, TabsTrigger } from "@/components/ui/tabs";
import type { BlockConfig } from "@shared/schema-types";
import { BuilderInspectorPanel } from "../BuilderInspectorPanel";
import { DocsPageTab } from "./DocsPageTab";
import { DocsSettingsTab } from "./DocsSettingsTab";
import { TAB_TRIGGER_CLASS } from "./docs-rail-classes";

/** The triggers of the right panel's tabs: Page and Docs always, Block while a block is picked. */
export function DocsPanelTriggers({ hasBlock }: { hasBlock: boolean }): ReactElement {
	return (
		<>
			<TabsTrigger value="page" className={TAB_TRIGGER_CLASS}>
				Page
			</TabsTrigger>
			<TabsTrigger value="docs" className={TAB_TRIGGER_CLASS}>
				Docs
			</TabsTrigger>
			{hasBlock ? (
				<TabsTrigger value="block" className={TAB_TRIGGER_CLASS}>
					Block
				</TabsTrigger>
			) : null}
		</>
	);
}

type BodyProps = {
	/** Leaves room above the bodies when the tabs sit directly over them (the narrow rail). */
	spaced?: boolean;
	selectedBlock: BlockConfig | null;
	parentBlock: BlockConfig | null;
	updateBlock: (blockId: string, updates: Partial<BlockConfig>) => void;
	setHoverHighlight: (area: "padding" | "margin" | null) => void;
};

const SCROLL_CLASS = "min-h-0 flex-1 overflow-y-auto overscroll-contain pb-6";

/** What each tab of the right panel shows. Only the open tab is mounted. */
export function DocsPanelBodies({ spaced = false, selectedBlock, parentBlock, updateBlock, setHoverHighlight }: BodyProps): ReactElement {
	const gap = spaced ? "mt-4" : "mt-0";
	return (
		<>
			<TabsContent value="page" className={`${SCROLL_CLASS} ${gap}`}>
				<DocsPageTab />
			</TabsContent>
			<TabsContent value="docs" className={`${SCROLL_CLASS} ${gap}`}>
				<DocsSettingsTab />
			</TabsContent>
			{selectedBlock ? (
				<TabsContent value="block" className={`${gap} flex min-h-0 flex-1 flex-col`}>
					<BuilderInspectorPanel selectedBlock={selectedBlock} parentBlock={parentBlock} updateBlock={updateBlock} setHoverHighlight={setHoverHighlight} />
				</TabsContent>
			) : null}
		</>
	);
}
