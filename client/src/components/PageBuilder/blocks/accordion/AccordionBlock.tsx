import React, { useMemo } from "react";
import type { BlockConfig } from "@shared/schema-types";
import { ListCollapse } from "lucide-react";
import {
	ACCORDION_ITEM_BLOCK_NAME,
	DEFAULT_ACCORDION_CONTENT,
	readAccordionContent,
	type AccordionContent,
} from "@shared/accordion-model";
import { ContainerChildren } from "../../BlockRenderer";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { AccordionContext } from "./accordion-context";
import { AccordionSettings } from "./accordion-settings";

type AccordionCanvasProps = {
	hostBlock: BlockConfig;
	content: AccordionContent;
	isPreview?: boolean;
	onNestedBlockChange?: (updated: BlockConfig) => void;
};

/**
 * Canvas view: the items are ordinary child blocks (select, drag, reorder like any block).
 * The look comes from the same CSS the published page uses (`buildAccordionCss`).
 */
function AccordionCanvas({ hostBlock, content, isPreview, onNestedBlockChange }: AccordionCanvasProps) {
	const children = hostBlock.children ?? [];
	const itemIds = useMemo(
		() => children.filter((child) => child.name === ACCORDION_ITEM_BLOCK_NAME).map((child) => child.id),
		[children],
	);
	const context = useMemo(() => ({ content, itemIds }), [content, itemIds]);

	return (
		<AccordionContext.Provider value={context}>
			<div className="wp-block-accordion">
				<ContainerChildren
					block={hostBlock}
					isPreview={isPreview ?? false}
					stackClassName="np-accordion"
					onBlockChange={onNestedBlockChange}
				/>
			</div>
		</AccordionContext.Provider>
	);
}

const AccordionBlock = createBlockDefinition<AccordionContent>({
	...catalogMeta("core/accordion"),
	icon: ListCollapse,
	handlesOwnChildren: true,
	defaultContent: DEFAULT_ACCORDION_CONTENT,
	parseContent: (raw) => readAccordionContent(raw),
	settings: AccordionSettings,
	hasSettings: true,
	render: ({ value, content, isPreview, onNestedBlockChange }) => (
		<AccordionCanvas
			hostBlock={value}
			content={content}
			isPreview={isPreview}
			onNestedBlockChange={onNestedBlockChange}
		/>
	),
});

export default AccordionBlock;
