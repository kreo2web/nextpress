import * as React from "react";
import type { BlockConfig } from "@shared/schema-types";
import { readCodeGroupContent } from "@shared/blocks/code-group-model";
import { TabsView } from "@shared/blocks/tabs-view";
import type { ViewAttributes } from "@shared/blocks/view-attributes";
import { codeGroupSyncKey, codeTabLabel } from "@shared/markdown/components/code-tab-label";
import { readCodeGroupTabs } from "@shared/markdown/components/code-group-tabs";
import { getRenderProps, renderChildBlocks } from "../render-helpers";

/**
 * Code group, published: Tabs markup (so `/vendor/tabs.js` switches it) with `np-code-group`. The
 * tab bar carries the tab names as `data-np-sync`, so groups with the same names switch together
 * and, with `remember`, the choice follows the reader to the next page.
 */
export function CodeGroupBlock(block: BlockConfig) {
	const { style, className, attributes } = getRenderProps(block);
	const { remember } = readCodeGroupContent(block.content);
	const { codes, others } = readCodeGroupTabs(block.children ?? []);
	const labels = codes.map(({ title, language }) => codeTabLabel({ title, language }));

	return (
		<TabsView
			id={block.id}
			look="underline"
			extraClassName="np-code-group"
			className={className}
			style={style}
			attributes={attributes as ViewAttributes}
			listAttributes={{ "data-np-sync": codeGroupSyncKey(labels), "data-np-remember": remember ? "true" : "false" }}
			tabs={codes.map(({ block: code }, index) => ({ key: code.id, title: labels[index], panel: renderChildBlocks([code]) }))}
			after={others.length > 0 ? renderChildBlocks(others) : null}
		/>
	);
}
