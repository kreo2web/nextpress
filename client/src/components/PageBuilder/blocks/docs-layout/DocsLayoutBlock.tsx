import React, { useMemo, useState } from "react";
import type { BlockConfig } from "@shared/schema-types";
import { PanelLeft } from "lucide-react";
import { DEFAULT_DOCS_LAYOUT_CONTENT, EMPTY_DOCS_BOUND, readDocsLayoutContent, type DocsLayoutContent } from "@shared/blocks/docs-layout-model";
import { DocsLayoutView } from "@shared/blocks/docs-layout-view";
import { buildDocsBound, pickTocHeadings } from "@shared/blocks/docs-layout-tree";
import { extractPageText } from "@shared/content-text";
import { ContainerChildren } from "../../BlockRenderer";
import { usePageContext } from "../../PageContext";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { DocsLayoutSettings } from "./docs-layout-settings";
import { useSiteDocsPages } from "./use-site-docs-pages";

type DocsLayoutCanvasProps = {
	hostBlock: BlockConfig;
	content: DocsLayoutContent;
	styles?: React.CSSProperties;
	isPreview?: boolean;
	onNestedBlockChange?: (updated: BlockConfig) => void;
};

/**
 * Canvas view: the same markup as the page. The sidebar is drawn from the site's pages with the
 * same builder the server uses, and "On this page" from the blocks inside, so it follows edits as
 * you type. Links do nothing here.
 */
function DocsLayoutCanvas({ hostBlock, content, styles, isPreview, onNestedBlockChange }: DocsLayoutCanvasProps) {
	const { pageId } = usePageContext();
	const { pages } = useSiteDocsPages();
	const [menuOpen, setMenuOpen] = useState(false);

	const headings = useMemo(() => pickTocHeadings(extractPageText(hostBlock.children ?? []).headings), [hostBlock.children]);
	const bound = useMemo(
		() => (pageId ? buildDocsBound({ pages, currentPageId: pageId, rootPageId: content.rootPageId, headings }) : { ...EMPTY_DOCS_BOUND, headings }),
		[pages, pageId, content.rootPageId, headings],
	);

	return (
		<DocsLayoutView
			blockId={hostBlock.id}
			content={content}
			bound={bound}
			style={styles}
			menuOpen={menuOpen}
			onMenuClick={() => setMenuOpen((open) => !open)}
			attributes={{
				onClickCapture: (event: React.MouseEvent) => {
					if ((event.target as Element).closest("a[href]")) event.preventDefault();
				},
			}}
		>
			<ContainerChildren block={hostBlock} isPreview={isPreview ?? false} onBlockChange={onNestedBlockChange} />
		</DocsLayoutView>
	);
}

const DocsLayoutBlock = createBlockDefinition<DocsLayoutContent>({
	...catalogMeta("core/docs-layout"),
	icon: PanelLeft,
	handlesOwnChildren: true,
	defaultContent: DEFAULT_DOCS_LAYOUT_CONTENT,
	parseContent: (raw) => readDocsLayoutContent(raw),
	settings: DocsLayoutSettings,
	hasSettings: true,
	render: ({ value, content, styles, isPreview, onNestedBlockChange }) => (
		<DocsLayoutCanvas hostBlock={value} content={content} styles={styles} isPreview={isPreview} onNestedBlockChange={onNestedBlockChange} />
	),
});

export default DocsLayoutBlock;
