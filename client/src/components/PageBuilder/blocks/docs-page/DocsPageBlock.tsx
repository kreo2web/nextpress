import React, { useMemo } from "react";
import type { BlockConfig } from "@shared/schema-types";
import { FileText } from "lucide-react";
import { buildDocsPageBound } from "@shared/blocks/bind-docs-shell";
import { DEFAULT_DOCS_PAGE_CONTENT, readDocsPageContent, type DocsPageContent } from "@shared/blocks/docs-page-model";
import { DocsPageView } from "@shared/blocks/docs-page-view";
import { ContainerChildren } from "../../BlockRenderer";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { useDocsEditor } from "../docs-shell/docs-editor-context";
import { DocsPageSettings } from "./docs-page-settings";

type DocsPageCanvasProps = {
	hostBlock: BlockConfig;
	content: DocsPageContent;
	styles?: React.CSSProperties;
	isPreview?: boolean;
	onNestedBlockChange?: (updated: BlockConfig) => void;
};

/**
 * Canvas view: the same `DocsPageView` as the published page. "On this page" follows the blocks
 * inside as you edit; title, breadcrumbs and previous/next come from the site's pages.
 */
function DocsPageCanvas({ hostBlock, content, styles, isPreview, onNestedBlockChange }: DocsPageCanvasProps) {
	const docs = useDocsEditor();
	const bound = useMemo(
		() =>
			docs?.pageId
				? buildDocsPageBound({
					children: hostBlock.children ?? [],
					pages: docs.pages,
					currentPageId: docs.pageId,
					rootPageId: docs.rootPageId,
					description: docs.description,
					features: docs.features,
				})
				: null,
		[docs, hostBlock.children],
	);

	return (
		<DocsPageView
			content={content}
			bound={bound}
			style={styles}
			attributes={{
				onClickCapture: (event: React.MouseEvent) => {
					if ((event.target as Element).closest("a[href]")) event.preventDefault();
				},
			}}
		>
			<ContainerChildren block={hostBlock} isPreview={isPreview ?? false} onBlockChange={onNestedBlockChange} />
		</DocsPageView>
	);
}

const DocsPageBlock = createBlockDefinition<DocsPageContent>({
	...catalogMeta("docs/page"),
	icon: FileText,
	handlesOwnChildren: true,
	defaultContent: DEFAULT_DOCS_PAGE_CONTENT,
	parseContent: (raw) => readDocsPageContent(raw),
	settings: DocsPageSettings,
	hasSettings: true,
	render: ({ value, content, styles, isPreview, onNestedBlockChange }) => (
		<DocsPageCanvas hostBlock={value} content={content} styles={styles} isPreview={isPreview} onNestedBlockChange={onNestedBlockChange} />
	),
});

export default DocsPageBlock;
