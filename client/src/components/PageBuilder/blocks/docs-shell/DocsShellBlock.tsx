import React, { useMemo, useState } from "react";
import type { BlockConfig } from "@shared/schema-types";
import { PanelTop } from "lucide-react";
import { buildDocsShellBound } from "@shared/blocks/bind-docs-shell";
import { DEFAULT_DOCS_FEATURES, DEFAULT_DOCS_SHELL_CONTENT, readDocsShellContent, type DocsShellContent } from "@shared/blocks/docs-shell-model";
import { DocsShellView } from "@shared/blocks/docs-shell-view";
import { ContainerChildren } from "../../BlockRenderer";
import { usePageContext } from "../../PageContext";
import { createBlockDefinition } from "../createBlockDefinition";
import { catalogMeta } from "../catalog-meta";
import { useSiteDocsPages } from "../docs-layout/use-site-docs-pages";
import { useDocsCanvasSource } from "../../docs-mode/docs-canvas-source";
import { useDocsFrame } from "../../docs-mode/docs-frame-context";
import { readFramePageLink, readFrameRegion } from "../../docs-mode/docs-frame-regions";
import { DocsEditorProvider } from "./docs-editor-context";
import { DocsShellSettings } from "./docs-shell-settings";
import { useRootShell } from "./use-root-shell";

type DocsShellCanvasProps = {
	hostBlock: BlockConfig;
	content: DocsShellContent;
	styles?: React.CSSProperties;
	isPreview?: boolean;
	onNestedBlockChange?: (updated: BlockConfig) => void;
};

/**
 * Canvas view: the same `DocsShellView` as the published page. Sidebar and top bar come from the
 * site's pages (and the root page's shell when inheriting) with the same builder the server uses.
 * Links do nothing here. In the docs editor the top bar and the sidebar are not blocks: clicking
 * one opens its settings in the right panel, and the pages come from the docs' own tree.
 */
function DocsShellCanvas({ hostBlock, content, styles, isPreview, onNestedBlockChange }: DocsShellCanvasProps) {
	const { pageId, pageOther } = usePageContext();
	const docsFrame = useDocsFrame();
	const docsSource = useDocsCanvasSource();
	const { pages } = useSiteDocsPages();
	const { rootShell } = useRootShell({ pages, pageId: pageId ?? "" });
	const [menuOpen, setMenuOpen] = useState(false);

	const bound = useMemo(
		() => (pageId ? buildDocsShellBound({ own: content, pages, currentPageId: pageId, rootShell }) : null),
		[content, pages, pageId, rootShell],
	);
	const description = docsSource?.description ?? pageOther?.seo?.metaDescription ?? "";
	const editorValue = useMemo(
		() => ({
			pages,
			pageId: pageId ?? "",
			rootPageId: bound?.settings.rootPageId ?? "",
			description,
			features: bound?.settings.features ?? DEFAULT_DOCS_FEATURES,
		}),
		[pages, pageId, bound?.settings.rootPageId, bound?.settings.features, description],
	);

	return (
		<DocsShellView
			blockId={hostBlock.id}
			bound={bound}
			style={styles}
			menuOpen={menuOpen}
			onMenuClick={() => setMenuOpen((open) => !open)}
			className={docsFrame ? "npb-docs-frame" : undefined}
			attributes={{
				onClickCapture: (event: React.MouseEvent) => {
					const target = event.target as Element;
					if (target.closest("a[href], [data-np-search-open]")) event.preventDefault();
					if (!docsFrame) return;
					const link = readFramePageLink(target);
					if (link !== null && docsFrame.openLink(link)) {
						event.stopPropagation();
						return;
					}
					const region = readFrameRegion(target);
					if (!region) return;
					event.stopPropagation();
					docsFrame.openRegion(region);
				},
			}}
		>
			<DocsEditorProvider value={editorValue}>
				<ContainerChildren block={hostBlock} isPreview={isPreview ?? false} onBlockChange={onNestedBlockChange} />
			</DocsEditorProvider>
		</DocsShellView>
	);
}

const DocsShellBlock = createBlockDefinition<DocsShellContent>({
	...catalogMeta("docs/shell"),
	icon: PanelTop,
	handlesOwnChildren: true,
	defaultContent: DEFAULT_DOCS_SHELL_CONTENT,
	parseContent: (raw) => readDocsShellContent(raw),
	settings: DocsShellSettings,
	hasSettings: true,
	render: ({ value, content, styles, isPreview, onNestedBlockChange }) => (
		<DocsShellCanvas hostBlock={value} content={content} styles={styles} isPreview={isPreview} onNestedBlockChange={onNestedBlockChange} />
	),
});

export default DocsShellBlock;
